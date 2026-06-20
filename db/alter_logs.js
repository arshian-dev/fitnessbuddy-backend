const db = require('./db');

async function runAlters() {
  try {
    console.log("Altering progress_logs...");
    
    // Add columns if they don't exist
    await db.query(`ALTER TABLE progress_logs ADD COLUMN IF NOT EXISTS calories_logged INT DEFAULT 0;`);
    await db.query(`ALTER TABLE progress_logs ADD COLUMN IF NOT EXISTS protein_logged INT DEFAULT 0;`);
    await db.query(`ALTER TABLE progress_logs ADD COLUMN IF NOT EXISTS carbs_logged INT DEFAULT 0;`);
    await db.query(`ALTER TABLE progress_logs ADD COLUMN IF NOT EXISTS fats_logged INT DEFAULT 0;`);
    await db.query(`ALTER TABLE progress_logs ADD COLUMN IF NOT EXISTS workout_completed BOOLEAN DEFAULT false;`);
    
    console.log("Alterations complete.");
  } catch (err) {
    console.error("Error running alters:", err);
  } finally {
    process.exit(0);
  }
}

runAlters();
