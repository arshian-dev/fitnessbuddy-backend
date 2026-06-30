const fs = require('fs');
const path = require('path');
const db = require('../db/db');

async function initDB() {
  try {
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('Running schema.sql on Neon DB...');
    await db.query(schema);
    console.log('Schema initialized successfully!');
  } catch (error) {
    console.error('Schema initialization failed:', error);
  } finally {
    process.exit(0);
  }
}

initDB();
