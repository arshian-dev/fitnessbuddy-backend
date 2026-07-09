const db = require('./db');
const { generateWorkoutPlan, generateNutritionPlan } = require('../services/recommendationEngine');

async function seed() {
  console.log('Starting database seeding...');
  
  try {
    // Clean existing data
    console.log('Cleaning existing tables...');
    await db.query('TRUNCATE users, health_profiles, workout_plans, nutrition_plans, progress_logs, escalation_alerts, exercises_library, food_library CASCADE');

    // Seed Food Library
    console.log('Seeding Food Library...');
    await db.query(`
      INSERT INTO food_library (name, calories, protein, carbs, fats, serving_unit) VALUES
      ('Chicken Breast (Cooked)', 165, 31, 0, 3.6, '100g'),
      ('Basmati Rice (Cooked)', 130, 2.7, 28, 0.3, '100g'),
      ('Whole Wheat Roti', 120, 4, 20, 3, '1 medium (40g)'),
      ('Paneer', 265, 18, 1.2, 20, '100g'),
      ('Yellow Daal (Cooked)', 116, 9, 20, 0.4, '100g'),
      ('Greek Yogurt', 59, 10, 3.6, 0.4, '100g'),
      ('Almonds', 579, 21, 21, 49, '100g'),
      ('Eggs', 155, 13, 1.1, 11, '100g')
    `);

    // Seed Exercise Library
    console.log('Seeding Exercise Library...');
    await db.query(`
      INSERT INTO exercises_library (name, category) VALUES
      ('Barbell Back Squat', 'Lower Body - Quad Focus'),
      ('Romanian Deadlift', 'Lower Body - Hamstring Focus'),
      ('Leg Press', 'Lower Body - Quad Focus'),
      ('Bench Press', 'Upper Body - Push'),
      ('Overhead Press', 'Upper Body - Push'),
      ('Pull-ups', 'Upper Body - Pull'),
      ('Barbell Row', 'Upper Body - Pull'),
      ('Bicep Curls', 'Arms'),
      ('Tricep Extensions', 'Arms'),
      ('Plank', 'Core')
    `);

    // 1. Ensure Coach Trainer Tenant Exists and Get its ID
    await db.query(`
      INSERT INTO trainers (name, subdomain, ai_system_prompt)
      VALUES (
          'Fitness Buddy',
          'coach',
          'You are Fitness Buddy AI, a professional fitness trainer. You specialize in South Asian diets, emphasizing cultural foods like daal, roti, and rice but controlled for macros. You communicate directly, motivating your clients, and strictly adhere to the nutrition rules provided in your knowledge base.'
      ) ON CONFLICT (subdomain) DO NOTHING;
    `);

    const trainerRes = await db.query(`SELECT id FROM trainers WHERE subdomain = 'coach' LIMIT 1`);
    const trainerId = trainerRes.rowCount > 0 ? trainerRes.rows[0].id : null;

    // 2. Create Coach Account
    console.log('Creating Coach Account...');
    const coachRes = await db.query(
      `INSERT INTO users (name, email, role, coach_code, trainer_id)
       VALUES ('Fitness Buddy Coach', 'coach@test.com', 'COACH', 'FITNESS-COACH', $1) RETURNING id`,
       [trainerId]
    );
    const coachId = coachRes.rows[0].id;
    console.log(`Coach created with ID: ${coachId}`);

    // 3. Create Expat Client (Low adherence, plateau, knee injury)
    console.log('Creating Expat Client...');
    const expatUser = await db.query(
      `INSERT INTO users (name, email, role, assigned_coach_id, trainer_id)
       VALUES ('Zarrar Ahmed', 'expat@test.com', 'CLIENT', $1, $2) RETURNING id`,
      [coachId, trainerId]
    );
    const expatId = expatUser.rows[0].id;

    await db.query(
      `INSERT INTO health_profiles (
        user_id, age, gender, weight, height, conditions, medications, cycle_status,
        stress_level, sleep_hours, adherence_probability, recovery_score, coaching_complexity,
        diet_strictness_tolerance, cooking_control, location, occupation, equipment_access,
        home_or_gym, chai_cups, water_glasses, sleep_consistency, anxiety_depression,
        bloodwork_status, supplement_comfort, contact_number, end_goal_description,
        workout_timing, workout_duration, smoking_status
      ) VALUES ($1, 32, 'MALE', 90.0, 178.0, '{ "Knee injury" }', true, 'NOT_APPLICABLE',
               'HIGH', 5.5, 0.3, 0.2, 'HIGH', 'STRICT', 'NONE', 'U.K.', 'Employed',
               '{"Free weights", "Cable machines"}', 'GYM', 2, 6, 'IRREGULAR', 'YES',
               'HAD_IT_BUT_DONT_KNOW', true, '+447912345678', 'Brad Pitt from Fight Club but desi version',
               'EVENING', '45-60', 'NO')`,
      [expatId]
    );

    const expatWorkout = generateWorkoutPlan(expatId, { recoveryScore: 0.2 }, { conditions: ['Knee injury'], home_or_gym: 'GYM', equipment_access: ['Free weights', 'Cable machines'] });
    const expatNutrition = generateNutritionPlan(expatId, {}, { age: 32, gender: 'MALE', weight: 90.0, height: 178.0, goal: 'FAT_LOSS', chai_cups: 2 });

    await db.query(
      `INSERT INTO workout_plans (user_id, split, frequency, exercises, progression_scheme, generated_by, version)
       VALUES ($1, $2, $3, $4, $5, 'AI', 1)`,
      [expatId, expatWorkout.split, expatWorkout.frequency, JSON.stringify(expatWorkout.exercises), expatWorkout.progression_scheme]
    );

    await db.query(
      `INSERT INTO nutrition_plans (user_id, calories, protein, carbs, fats, meal_templates)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [expatId, expatNutrition.calories, expatNutrition.protein, expatNutrition.carbs, expatNutrition.fats, JSON.stringify(expatNutrition.meal_templates)]
    );

    // Logs for Expat (shows a plateau over 3 weeks)
    await db.query(
      `INSERT INTO progress_logs (user_id, log_date, weight, waist_cm, energy_score, mood_score, workouts_completed, ai_insight)
       VALUES ($1, CURRENT_DATE - INTERVAL '14 days', 90.0, 96.0, 6, 6, 3, 'Weight stable. Focus on steps.')`,
      [expatId]
    );
    await db.query(
      `INSERT INTO progress_logs (user_id, log_date, weight, waist_cm, energy_score, mood_score, workouts_completed, ai_insight)
       VALUES ($1, CURRENT_DATE - INTERVAL '7 days', 90.0, 96.0, 5, 5, 4, 'Weight still stable. Adherence is high.')`,
      [expatId]
    );
    await db.query(
      `INSERT INTO progress_logs (user_id, log_date, weight, waist_cm, energy_score, mood_score, workouts_completed, ai_insight)
       VALUES ($1, CURRENT_DATE, 90.0, 96.0, 5, 4, 4, 'Weight remains at 90.0kg. High adherence. Plateau warning.')`,
      [expatId]
    );

    // Insert active alert for Expat
    await db.query(
      `INSERT INTO escalation_alerts (user_id, type, severity, details)
       VALUES ($1, 'PLATEAU', 'MEDIUM', 'Plateau detected: Weight remained stable at 90.0kg for 3 consecutive weeks despite high compliance.')`,
      [expatId]
    );

    // 4. Create Pro Client (High adherence, intermediate split, progressive load)
    console.log('Creating Pro Client...');
    const proUser = await db.query(
      `INSERT INTO users (name, email, role, assigned_coach_id, trainer_id)
       VALUES ('Bilal Siddiqui', 'pro@test.com', 'CLIENT', $1, $2) RETURNING id`,
      [coachId, trainerId]
    );
    const proId = proUser.rows[0].id;

    await db.query(
      `INSERT INTO health_profiles (
        user_id, age, gender, weight, height, conditions, medications, cycle_status,
        stress_level, sleep_hours, adherence_probability, recovery_score, coaching_complexity,
        diet_strictness_tolerance, cooking_control, location, occupation, equipment_access,
        home_or_gym, chai_cups, water_glasses, sleep_consistency, anxiety_depression,
        bloodwork_status, supplement_comfort, contact_number, end_goal_description,
        workout_timing, workout_duration, smoking_status
      ) VALUES ($1, 27, 'MALE', 78.0, 175.0, '{}', false, 'NOT_APPLICABLE',
               'MEDIUM', 7.0, 0.75, 0.65, 'LOW', 'MODERATE', 'FULL', 'Pakistan', 'Employed',
               '{"All gym machines", "Free weights"}', 'GYM', 1, 8, 'CONSISTENT', 'NO',
               'YES_NORMAL', true, '+923001234567', 'Lean and athletic look, increase strength',
               'EVENING', '60-90', 'NO')`,
      [proId]
    );

    const proWorkout = generateWorkoutPlan(proId, { recoveryScore: 0.65 }, { experience: 'INTERMEDIATE', home_or_gym: 'GYM', equipment_access: ['All gym machines', 'Free weights'] });
    const proNutrition = generateNutritionPlan(proId, {}, { age: 27, gender: 'MALE', weight: 78.0, height: 175.0, goal: 'FAT_LOSS', chai_cups: 1 });

    await db.query(
      `INSERT INTO workout_plans (user_id, split, frequency, exercises, progression_scheme, generated_by, version)
       VALUES ($1, $2, $3, $4, $5, 'AI', 1)`,
      [proId, proWorkout.split, proWorkout.frequency, JSON.stringify(proWorkout.exercises), proWorkout.progression_scheme]
    );

    await db.query(
      `INSERT INTO nutrition_plans (user_id, calories, protein, carbs, fats, meal_templates)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [proId, proNutrition.calories, proNutrition.protein, proNutrition.carbs, proNutrition.fats, JSON.stringify(proNutrition.meal_templates)]
    );

    // Logs for Pro (consistent drop)
    await db.query(
      `INSERT INTO progress_logs (user_id, log_date, weight, waist_cm, energy_score, mood_score, workouts_completed, ai_insight)
       VALUES ($1, CURRENT_DATE - INTERVAL '7 days', 78.0, 88.0, 8, 8, 4, 'Initial weight logged.')`,
      [proId]
    );
    await db.query(
      `INSERT INTO progress_logs (user_id, log_date, weight, waist_cm, energy_score, mood_score, workouts_completed, ai_insight)
       VALUES ($1, CURRENT_DATE, 77.2, 87.0, 9, 8, 4, 'Weight dropped 0.8kg. Strength is increasing. Progression on track.')`,
      [proId]
    );


    // 5. Create PCOS Client (Female with PCOS, irregular cycle, compliance warning)
    console.log('Creating PCOS Client...');
    const pcosUser = await db.query(
      `INSERT INTO users (name, email, role, assigned_coach_id, trainer_id)
       VALUES ('Amina Shah', 'pcos@test.com', 'CLIENT', $1, $2) RETURNING id`,
      [coachId, trainerId]
    );
    const pcosId = pcosUser.rows[0].id;

    await db.query(
      `INSERT INTO health_profiles (
        user_id, age, gender, weight, height, conditions, medications, cycle_status,
        stress_level, sleep_hours, adherence_probability, recovery_score, coaching_complexity,
        diet_strictness_tolerance, cooking_control, location, occupation, equipment_access,
        home_or_gym, chai_cups, water_glasses, sleep_consistency, anxiety_depression,
        bloodwork_status, supplement_comfort, contact_number, end_goal_description,
        workout_timing, workout_duration, smoking_status
      ) VALUES ($1, 29, 'FEMALE', 68.0, 160.0, '{ "PCOS" }', false, 'IRREGULAR',
               'HIGH', 6.0, 0.45, 0.35, 'HIGH', 'MODERATE', 'PARTIAL', 'UAE/Gulf', 'Self-employed',
               '{"Free weights", "Resistance bands"}', 'HOME', 0, 5, 'IRREGULAR', 'MILD_SYMPTOMS',
               'YES_DEFICIENT', true, '+971501234567', 'Fit back in shaadi clothes, balance hormones',
               'MORNING', '30-45', 'NO')`,
      [pcosId]
    );

    const pcosWorkout = generateWorkoutPlan(pcosId, { recoveryScore: 0.35 }, { conditions: ['PCOS'] });
    const pcosNutrition = generateNutritionPlan(pcosId, {}, { age: 29, gender: 'FEMALE', weight: 68.0, height: 160.0, goal: 'FAT_LOSS' });

    await db.query(
      `INSERT INTO workout_plans (user_id, split, frequency, exercises, progression_scheme, generated_by, version)
       VALUES ($1, $2, $3, $4, $5, 'AI', 1)`,
      [pcosId, pcosWorkout.split, pcosWorkout.frequency, JSON.stringify(pcosWorkout.exercises), pcosWorkout.progression_scheme]
    );

    await db.query(
      `INSERT INTO nutrition_plans (user_id, calories, protein, carbs, fats, meal_templates)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [pcosId, pcosNutrition.calories, pcosNutrition.protein, pcosNutrition.carbs, pcosNutrition.fats, JSON.stringify(pcosNutrition.meal_templates)]
    );

    // Logs for PCOS (shows poor adherence)
    await db.query(
      `INSERT INTO progress_logs (user_id, log_date, weight, waist_cm, energy_score, mood_score, workouts_completed, ai_insight)
       VALUES ($1, CURRENT_DATE, 68.2, 82.5, 4, 4, 1, 'Adherence drop: completed only 1 of 3 workouts. High fatigue.')`,
      [pcosId]
    );

    // Active alert for PCOS client
    await db.query(
      `INSERT INTO escalation_alerts (user_id, type, severity, details)
       VALUES ($1, 'COMPLIANCE', 'MEDIUM', 'Compliance failure: User completed only 1 of 3 workouts this week.')`,
      [pcosId]
    );

    console.log('\nSeeding completed successfully!');
  } catch (err) {
    console.error('Seeding failed with error:', err.message);
  } finally {
    process.exit(0);
  }
}

seed();
