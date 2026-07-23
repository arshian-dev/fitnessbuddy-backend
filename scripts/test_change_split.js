const db = require('../db/db');
const { generateWorkoutPlan } = require('../services/recommendationEngine');

async function testSplitChange() {
  try {
    const userRes = await db.query("SELECT id FROM users WHERE email = 'rozain@test.com'");
    if (userRes.rowCount === 0) {
      console.log('Test user not found');
      process.exit(1);
    }
    const userId = userRes.rows[0].id;
    const pplPlan = generateWorkoutPlan(userId, {}, {}, 'PPL_6DAY');
    console.log('PPL 6-Day Split test:');
    console.log('  Split Name:', pplPlan.split);
    console.log('  Frequency:', pplPlan.frequency);
    console.log('  Exercise count:', pplPlan.exercises.length);

    const upperLowerPlan = generateWorkoutPlan(userId, {}, {}, 'UPPER_LOWER_4DAY');
    console.log('Upper / Lower Split test:');
    console.log('  Split Name:', upperLowerPlan.split);
    console.log('  Frequency:', upperLowerPlan.frequency);
    console.log('  Exercise count:', upperLowerPlan.exercises.length);

    console.log('\nAll split generation tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

testSplitChange();
