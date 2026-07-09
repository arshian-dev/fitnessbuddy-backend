const db = require('../db/db');

async function checkLogs() {
  try {
    const res = await db.query('SELECT * FROM bloodwork_logs ORDER BY created_at DESC LIMIT 1');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
checkLogs();
