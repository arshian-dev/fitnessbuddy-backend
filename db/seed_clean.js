const db = require('./db');

async function seedCleanData() {
  console.log('Starting clean seeding...');
  try {
    // 1. Clean existing tables (except schema itself)
    console.log('Cleaning existing tables...');
    await db.query('TRUNCATE TABLE users, health_profiles, workout_plans, nutrition_plans, progress_logs, escalation_alerts, exercises_library, food_library CASCADE');

    // 2. Create Coach Account
    console.log('Creating Coach Account...');
    const coachRes = await db.query(
      `INSERT INTO users (name, email, role)
       VALUES ('Coach Salman', 'coach@test.com', 'COACH') RETURNING id`
    );
    const coachId = coachRes.rows[0].id;
    console.log(`Coach created with ID: ${coachId}`);

    // 3. Seed Exercises Library
    console.log('Seeding Exercises Library...');
    const defaultExercises = [
      ['Rotator Cuff Warmups (External & Internal Rotations)', 'Warmup'],
      ['Bodyweight Bulgarian Split Squats', 'Legs'],
      ['Standard Pushups (on knees if needed)', 'Chest'],
      ['Banded Lat Pulldowns or Banded Rows', 'Back'],
      ['Banded Pec Deck (Chest Flies)', 'Chest'],
      ['Dumbbell Goblet Squats', 'Legs'],
      ['Dumbbell Incline Bench Press', 'Chest'],
      ['Cable Bicep Curls', 'Arms'],
      ['Lying Leg Curls', 'Legs'],
      ['Barbell Deadlift', 'Back'],
      ['Romanian Deadlift', 'Legs'],
      ['Lat Pulldown (Gym)', 'Back'],
      ['Seated Cable Row', 'Back'],
      ['Leg Press', 'Legs'],
      ['Dumbbell Shoulder Press', 'Shoulders'],
      ['Plank', 'Core'],
      ['Hanging Knee Raises', 'Core'],
      ['Low Stress Walking / LISS Cardio', 'Cardio']
    ];
    for (const [name, cat] of defaultExercises) {
      await db.query(
        'INSERT INTO exercises_library (name, category) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
        [name, cat]
      );
    }

    // 4. Seed Food Library
    console.log('Seeding Food Library...');
    const defaultFoods = [
      ['Dawn Bran Bread', 75, 3.5, 12, 1, '1 slice'],
      ['Nestle Milk Pak', 150, 8, 12, 8, '250ml'],
      ['Nestle Milk Pak Lite', 90, 8, 12, 1.5, '250ml'],
      ['Egg (whole, boiled/poached)', 70, 6, 0.6, 5, '1 large'],
      ['Egg whites', 17, 3.6, 0.2, 0.1, '1 egg white'],
      ['Chicken Breast (cooked, boneless)', 165, 31, 0, 3.6, '100g'],
      ['Paneer (cottage cheese)', 265, 18, 3, 20, '100g'],
      ['Whey Protein Powder', 120, 24, 3, 1.5, '1 scoop'],
      ['Roti (whole wheat, medium)', 120, 3, 26, 0.5, '1 roti'],
      ['Dal Chana (cooked)', 230, 10, 40, 4, '1 cup'],
      ['Stevia Sweetener', 0, 0, 0, 0, '1 packet'],
      ['Canolive Oil / Olive Oil', 120, 0, 0, 14, '1 tbsp'],
      ['Basmati Rice (cooked)', 205, 4.2, 45, 0.4, '1 cup'],
      ['Seekh Kebab (chicken, grilled)', 110, 14, 2, 5, '1 piece'],
      ['Greek Yogurt (low-fat)', 60, 10, 3.6, 0.4, '100g']
    ];
    for (const [name, cal, prot, carb, fat, unit] of defaultFoods) {
      await db.query(
        `INSERT INTO food_library (name, calories, protein, carbs, fats, serving_unit)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (name) DO NOTHING`,
        [name, cal, prot, carb, fat, unit]
      );
    }

    console.log('\nSeeding completed successfully! Database is now in clean slate state.');
  } catch (err) {
    console.error('Seeding failed with error:', err.message);
  } finally {
    process.exit(0);
  }
}

seedCleanData();
