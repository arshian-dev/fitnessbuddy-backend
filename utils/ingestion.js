const { OpenAI } = require('openai');
const { YoutubeTranscript } = require('youtube-transcript');
const xlsx = require('xlsx');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const db = require('../db/db');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

function chunkText(text, maxChars = 2000) {
  const chunks = [];
  let currentChunk = '';
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

async function insertKnowledge(trainerId, sourceType, sourceName, content) {
  try {
    if (!content || content.trim().length < 20) return;
    
    const chunks = chunkText(content);
    let insertedCount = 0;
    
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await getEmbedding(chunk);
        
        await db.query(
          `INSERT INTO knowledge_base (trainer_id, source_type, source_name, content, embedding)
           VALUES ($1, $2, $3, $4, $5)`,
          [trainerId, sourceType, `${sourceName} - Part ${i+1}`, chunk, JSON.stringify(embedding)]
        );
        insertedCount++;
    }
    return insertedCount;
  } catch (err) {
    console.error(`Error inserting knowledge for ${sourceName}:`, err.message);
    throw err;
  }
}

async function ingestYoutubePlaylist(playlistUrl, trainerId) {
  console.log(`Starting background ingestion for playlist: ${playlistUrl}`);
  try {
    const response = await fetch(playlistUrl);
    const html = await response.text();
    
    // Extract video IDs
    const videoIdRegex = /"videoId":"([^"]+)"/g;
    const videoIds = new Set();
    let match;
    while ((match = videoIdRegex.exec(html)) !== null) {
        videoIds.add(match[1]);
    }
    
    const videoIdList = Array.from(videoIds);
    console.log(`Found ${videoIdList.length} unique videos in playlist.`);
    
    for (const videoId of videoIdList) {
        try {
            const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
            const fullText = transcriptData.map(t => t.text).join(' ');
            
            await insertKnowledge(trainerId, 'YOUTUBE_VIDEO', `YouTube Video ${videoId}`, fullText);
            console.log(`Successfully ingested Video ${videoId}`);
        } catch (err) {
            console.error(`Failed to fetch transcript for ${videoId}: ${err.message}`);
        }
    }
    console.log('Background YouTube Ingestion complete!');
  } catch(err) {
    console.error('Error in ingestYoutubePlaylist:', err.message);
  }
}

async function ingestSingleYoutube(videoId, trainerId) {
  try {
    const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
    const fullText = transcriptData.map(t => t.text).join(' ');
    
    await insertKnowledge(trainerId, 'YOUTUBE_VIDEO', `YouTube Video ${videoId}`, fullText);
    return true;
  } catch (err) {
    console.error(`Failed to fetch transcript for ${videoId}: ${err.message}`);
    throw err;
  }
}



async function ingestExcelBuffer(buffer, filename, trainerId) {
  try {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    let totalChunks = 0;
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);
      if (data.length > 0) {
        const textData = data.map(row => Object.entries(row).map(([k,v]) => `${k}: ${v}`).join(', ')).join('. ');
        const count = await insertKnowledge(trainerId, 'EXCEL_DATABASE', `${filename} - ${sheetName}`, textData);
        if (count) totalChunks += count;
      }
    }
    return totalChunks;
  } catch(e) {
    console.error(`Failed to parse excel ${filename}:`, e.message);
    throw e;
  }
}

async function ingestPdfBuffer(buffer, filename, trainerId) {
  try {
    const data = await pdf(buffer);
    return await insertKnowledge(trainerId, 'CLIENT_PLAN_PDF', filename, data.text);
  } catch(e) {
    console.error(`Failed to parse pdf ${filename}:`, e.message);
    throw e;
  }
}

async function ingestDocxBuffer(buffer, filename, trainerId) {
  try {
    const result = await mammoth.extractRawText({ buffer: buffer });
    return await insertKnowledge(trainerId, 'CLIENT_PLAN_DOCX', filename, result.value);
  } catch(e) {
    console.error(`Failed to parse docx ${filename}:`, e.message);
    throw e;
  }
}

module.exports = {
  getEmbedding,
  chunkText,
  insertKnowledge,
  ingestYoutubePlaylist,
  ingestSingleYoutube,
  ingestExcelBuffer,
  ingestPdfBuffer,
  ingestDocxBuffer
};
