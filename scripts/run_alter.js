const fs = require('fs');
const path = require('path');
const db = require('../db/db');

async function runAlter() {
  try {
    const schemaPath = path.join(__dirname, '../db/alter_schema_workout_logs.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('Running alter_schema_workout_logs.sql...');
    await db.query(schema);
    console.log('Schema updated successfully!');
  } catch (error) {
    console.error('Schema update failed:', error);
  } finally {
    process.exit(0);
  }
}

runAlter();
