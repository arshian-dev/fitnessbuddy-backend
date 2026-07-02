const db = require('./db/db');
async function test() {
  try {
    const user = await db.query('SELECT id FROM users LIMIT 1');
    if (user.rows.length === 0) { console.log('no user'); return; }
    const userId = user.rows[0].id;
    console.log('userId', userId);
    
    await db.query(
      `INSERT INTO workout_plans (user_id, split, frequency, exercises, progression_scheme, generated_by, version) VALUES ($1, $2, $3, $4, $5, 'COACH', $6) RETURNING *`,
      [userId, 'Test', 3, JSON.stringify([]), 'Test', 1]
    );
    console.log('success workout');
    
    await db.query(
      `INSERT INTO nutrition_plans (user_id, calories, protein, carbs, fats, meal_templates) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, 2000, 150, 200, 50, JSON.stringify([])]
    );
    console.log('success nutrition');
  } catch (err) {
    console.error('error:', err.message);
  }
  process.exit(0);
}
test();
