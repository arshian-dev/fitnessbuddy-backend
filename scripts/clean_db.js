const db = require('../db/db');

async function cleanLogs() {
  try {
    const r = await db.query('SELECT id, ai_analysis_summary FROM bloodwork_logs');
    for (let row of r.rows) {
      let clean = row.ai_analysis_summary.replace(/^```(markdown)?\n?/i, "").replace(/```$/i, "").trim();
      await db.query('UPDATE bloodwork_logs SET ai_analysis_summary=$1 WHERE id=$2', [clean, row.id]);
    }
    console.log('Cleaned db');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
cleanLogs();
