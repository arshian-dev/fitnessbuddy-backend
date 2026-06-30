const fs = require('fs');
const path = require('path');
const { YoutubeTranscript } = require('youtube-transcript');
const { OpenAI } = require('openai');
const db = require('../db/db');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

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
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await getEmbedding(chunk);
        
        await db.query(
          `INSERT INTO knowledge_base (trainer_id, source_type, source_name, content, embedding)
           VALUES ($1, $2, $3, $4, $5)`,
          [trainerId, sourceType, `${sourceName} - Part ${i+1}`, chunk, JSON.stringify(embedding)]
        );
        console.log(`Inserted chunk ${i+1}/${chunks.length} for ${sourceName}`);
    }
  } catch (err) {
    console.error(`Error inserting knowledge for ${sourceName}:`, err.message);
  }
}

async function ingestYoutubePlaylist(playlistUrl, trainerId) {
    console.log(`Fetching playlist: ${playlistUrl}`);
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
            console.log(`Processing Video ID: ${videoId}`);
            try {
                const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
                const fullText = transcriptData.map(t => t.text).join(' ');
                
                await insertKnowledge(trainerId, 'YOUTUBE_VIDEO', `YouTube Video ${videoId}`, fullText);
                console.log(`Successfully ingested Video ${videoId}`);
            } catch (err) {
                console.error(`Failed to fetch transcript for ${videoId}: ${err.message}`);
            }
        }
    } catch(err) {
        console.error('Error fetching playlist:', err.message);
    }
}

async function main() {
  try {
    const res = await db.query(`SELECT id FROM trainers WHERE subdomain = 'noroze' LIMIT 1`);
    if (res.rowCount === 0) {
      console.log('Trainer Noroze not found in DB!');
      return;
    }
    const trainerId = res.rows[0].id;
    console.log(`Found Noroze Trainer ID: ${trainerId}`);

    const playlistUrl = 'https://www.youtube.com/playlist?list=PLWUrpeI9MX_s';
    await ingestYoutubePlaylist(playlistUrl, trainerId);

    console.log('YouTube Ingestion complete!');
  } catch (err) {
    console.error('Ingestion failed:', err);
  } finally {
    process.exit(0);
  }
}

main();
