const fs = require('fs');
const xlsx = require('xlsx');
// Polyfill DOM objects for pdf-parse in Vercel edge/serverless environments
if (typeof global.DOMMatrix === 'undefined') global.DOMMatrix = class DOMMatrix {};
if (typeof global.Path2D === 'undefined') global.Path2D = class Path2D {};
if (typeof global.ImageData === 'undefined') global.ImageData = class ImageData {};

const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { YoutubeTranscript } = require('youtube-transcript');
const { OpenAI } = require('openai');
const db = require('../db/db');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'MISSING_API_KEY',
});

async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

// Simple chunking function to respect context windows
function chunkText(text, maxChars = 2000) {
  const chunks = [];
  let currentChunk = '';
  // Split by sentences roughly
  const sentences = text.split(/([.?!])\s+/);
  
  for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i] + (sentences[i+1] || '');
      if ((currentChunk.length + sentence.length) > maxChars && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = '';
      }
      currentChunk += sentence + ' ';
  }
  if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk);
  }
  return chunks;
}

async function processTextAndSave(trainerId, sourceType, sourceName, content) {
  try {
    if (!content || content.trim().length < 20) return [];
    
    const chunks = chunkText(content);
    const results = [];
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await getEmbedding(chunk);
        
        // Use proper pgvector formatting '[0.1, 0.2, ...]'
        const embeddingVector = `[${embedding.join(',')}]`;
        
        const result = await db.query(
          `INSERT INTO knowledge_base (trainer_id, source_type, source_name, content, embedding)
           VALUES ($1, $2, $3, $4, $5) RETURNING id, content, source_name`,
          [trainerId, sourceType, `${sourceName} - Part ${i+1}`, chunk, embeddingVector]
        );
        results.push(result.rows[0]);
    }
    return results;
  } catch (err) {
    console.error(`Error inserting knowledge for ${sourceName}:`, err.message);
    throw err;
  }
}

async function processFile(fileBuffer, originalName, mimeType, trainerId) {
  let textData = '';
  let sourceType = 'UNKNOWN';

  try {
    if (mimeType === 'application/pdf' || originalName.endsWith('.pdf')) {
      const data = await pdf(fileBuffer);
      textData = data.text;
      sourceType = 'PDF_DOCUMENT';
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || originalName.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      textData = result.value;
      sourceType = 'DOCX_DOCUMENT';
    } else if (mimeType.includes('spreadsheetml') || originalName.endsWith('.xlsx')) {
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);
        if (data.length > 0) {
          textData += data.map(row => Object.entries(row).map(([k,v]) => `${k}: ${v}`).join(', ')).join('. ') + '\n';
        }
      }
      sourceType = 'EXCEL_DATABASE';
    } else {
      throw new Error('Unsupported file format');
    }

    return await processTextAndSave(trainerId, sourceType, originalName, textData);
  } catch (error) {
    console.error('File processing error:', error);
    throw error;
  }
}

async function processYoutubeLink(url, trainerId) {
  try {
    let videoIds = [];
    
    // If it's a playlist, extract video IDs
    if (url.includes('playlist?list=')) {
      const response = await fetch(url);
      const html = await response.text();
      const videoIdRegex = /"videoId":"([^"]+)"/g;
      const ids = new Set();
      let match;
      while ((match = videoIdRegex.exec(html)) !== null) {
          ids.add(match[1]);
      }
      videoIds = Array.from(ids).slice(0, 5); // Limit to 5 videos for sync response to avoid Vercel timeout
    } else {
      // Single video ID extraction
      let videoId = url;
      if (url.includes('v=')) {
        videoId = new URL(url).searchParams.get('v');
      } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split('?')[0];
      }
      if (!videoId) throw new Error('Invalid YouTube URL');
      videoIds = [videoId];
    }

    let allResults = [];
    for (const vId of videoIds) {
      try {
        const transcripts = await YoutubeTranscript.fetchTranscript(vId);
        if (transcripts && transcripts.length > 0) {
          const textData = transcripts.map(t => t.text).join(' ');
          const results = await processTextAndSave(trainerId, 'YOUTUBE_VIDEO', `YouTube - ${vId}`, textData);
          allResults = allResults.concat(results);
        }
      } catch (err) {
        console.error(`Failed to process video ${vId}:`, err.message);
      }
    }
    
    if (allResults.length === 0) {
      throw new Error('No transcripts found for the provided YouTube link.');
    }
    
    return allResults;
  } catch (error) {
    console.error('YouTube processing error:', error);
    throw error;
  }
}

module.exports = {
  processFile,
  processYoutubeLink
};
