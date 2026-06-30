const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
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

// Simple chunking function to respect context windows
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

async function ingestExcel(filePath, trainerId) {
  console.log(`Ingesting Excel: ${filePath}`);
  try {
      const workbook = xlsx.readFile(filePath);
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);
        if (data.length > 0) {
          // Convert row objects into readable text lines instead of raw JSON
          const textData = data.map(row => Object.entries(row).map(([k,v]) => `${k}: ${v}`).join(', ')).join('. ');
          await insertKnowledge(trainerId, 'EXCEL_DATABASE', `${path.basename(filePath)} - ${sheetName}`, textData);
        }
      }
  } catch(e) {
      console.error(`Failed to parse excel ${filePath}:`, e.message);
  }
}

async function ingestPDF(filePath, trainerId) {
  console.log(`Ingesting PDF: ${filePath}`);
  try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      await insertKnowledge(trainerId, 'CLIENT_PLAN_PDF', path.basename(filePath), data.text);
  } catch(e) {
      console.error(`Failed to parse pdf ${filePath}:`, e.message);
  }
}

async function ingestDocx(filePath, trainerId) {
  console.log(`Ingesting DOCX: ${filePath}`);
  try {
      const result = await mammoth.extractRawText({ path: filePath });
      await insertKnowledge(trainerId, 'CLIENT_PLAN_DOCX', path.basename(filePath), result.value);
  } catch(e) {
      console.error(`Failed to parse docx ${filePath}:`, e.message);
  }
}

async function ingestDirectory(dirPath, trainerId) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await ingestDirectory(fullPath, trainerId);
    } else {
      if (entry.name.endsWith('.xlsx')) {
        await ingestExcel(fullPath, trainerId);
      } else if (entry.name.endsWith('.pdf')) {
        await ingestPDF(fullPath, trainerId);
      } else if (entry.name.endsWith('.docx')) {
        await ingestDocx(fullPath, trainerId);
      }
    }
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

    // Ingest Drive Data
    const driveDataPath = path.join(__dirname, '../../drive data');
    if (fs.existsSync(driveDataPath)) {
        await ingestDirectory(driveDataPath, trainerId);
    } else {
        console.log(`Drive data not found at ${driveDataPath}`);
    }

    console.log('Ingestion complete!');
  } catch (err) {
    console.error('Ingestion failed:', err);
  } finally {
    process.exit(0);
  }
}

main();
