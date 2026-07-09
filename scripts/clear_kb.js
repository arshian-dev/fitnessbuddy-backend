const db = require('./db/db');
async function run() {
  try {
    const email = 'noroze@test.com';
    const res = await db.query("SELECT trainer_id FROM users WHERE email = $1", [email]);
    if (res.rowCount > 0) {
      const trainerId = res.rows[0].trainer_id;
      const deleteRes = await db.query("DELETE FROM knowledge_base WHERE trainer_id = $1", [trainerId]);
      console.log('Deleted chunks:', deleteRes.rowCount);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}
run();
