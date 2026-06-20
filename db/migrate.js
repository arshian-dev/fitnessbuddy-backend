const fs = require('fs');
const path = require('path');
const db = require('./db');

async function migrate() {
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await db.query(schemaSql);
    console.log('Schema migration successful.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    process.exit(0);
  }
}

migrate();
