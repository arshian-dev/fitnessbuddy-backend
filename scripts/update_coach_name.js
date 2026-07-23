const db = require('../db/db');

async function updateCoachName() {
  try {
    const res = await db.query(
      "UPDATE users SET name = 'Coach Noroze Sikandar' WHERE email = 'coach@test.com' AND role = 'COACH' RETURNING *"
    );
    console.log('Successfully updated coach name:', res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('Failed to update coach name:', err);
    process.exit(1);
  }
}

updateCoachName();
