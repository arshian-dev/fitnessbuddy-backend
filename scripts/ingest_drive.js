const fs = require('fs');
const path = require('path');
const db = require('../db/db');
const { processFile } = require('../services/assetProcessor');

async function run() {
  const email = 'noroze@test.com';
  
  // Find trainer ID for the user
  const res = await db.query('SELECT trainer_id FROM users WHERE email = $1', [email]);
  if (res.rowCount === 0) {
    console.log(`User ${email} not found.`);
    process.exit(1);
  }
  const trainerId = res.rows[0].trainer_id;
  if (!trainerId) {
    console.log(`User ${email} does not have a linked trainer_id.`);
    process.exit(1);
  }
  
  console.log(`Starting ingestion for trainer ID: ${trainerId}`);
  const drivePath = path.join(__dirname, '../../drive data');

  // Recursively collect files
  async function walk(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(await walk(filePath));
      } else {
        results.push(filePath);
      }
    }
    return results;
  }

  console.log(`Scanning directory: ${drivePath}`);
  const files = await walk(drivePath);
  console.log(`Found ${files.length} total files. Filtering for documents...`);

  let processedCount = 0;
  let errorCount = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (['.pdf', '.docx', '.xlsx', '.xls'].includes(ext)) {
      console.log(`\nProcessing: ${file}`);
      const buffer = fs.readFileSync(file);
      try {
        let mime = '';
        if (ext === '.pdf') mime = 'application/pdf';
        if (ext === '.docx') mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        if (ext === '.xlsx' || ext === '.xls') mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        const chunks = await processFile(buffer, path.basename(file), mime, trainerId);
        console.log(`✅ Success: embedded ${chunks.length} chunks from ${path.basename(file)}`);
        processedCount++;
      } catch (err) {
        console.error(`❌ Error processing ${path.basename(file)}:`, err.message);
        errorCount++;
      }
    }
  }

  console.log(`\n=== Ingestion Complete ===`);
  console.log(`Successfully processed: ${processedCount} documents`);
  console.log(`Failed to process: ${errorCount} documents`);
  process.exit(0);
}

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
