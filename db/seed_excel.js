const fs = require('fs');
const path = require('path');
const db = require('./db');
const { generateWorkoutPlan, generateNutritionPlan } = require('../services/recommendationEngine');

async function seedExcelData() {
  console.log('Starting excel data seeding...');
  
  try {
    // Clean existing data
    console.log('Cleaning existing tables...');
    await db.query('TRUNCATE users, health_profiles, workout_plans, nutrition_plans, progress_logs, escalation_alerts CASCADE');

    // 1. Create Coach Account
    console.log('Creating Coach Account...');
    const coachRes = await db.query(
      `INSERT INTO users (name, email, role)
       VALUES ('Coach Salman', 'coach@test.com', 'COACH') RETURNING id`
    );
    const coachId = coachRes.rows[0].id;
    console.log(`Coach created with ID: ${coachId}`);

    // 1b. Seed Exercises Library
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

    // 1c. Seed Food Library
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

    // 2. Create Expat Client (Zarrar Ahmed - expat@test.com)
    console.log('Creating Expat Client...');
    const expatUser = await db.query(
      `INSERT INTO users (name, email, role)
       VALUES ('Zarrar Ahmed', 'expat@test.com', 'CLIENT') RETURNING id`
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

    // Logs for Expat
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

    await db.query(
      `INSERT INTO escalation_alerts (user_id, type, severity, details)
       VALUES ($1, 'PLATEAU', 'MEDIUM', 'Plateau detected: Weight remained stable at 90.0kg for 3 consecutive weeks despite high compliance.')`,
      [expatId]
    );

    // 3. Create Pro Client (Bilal Siddiqui - pro@test.com)
    console.log('Creating Pro Client...');
    const proUser = await db.query(
      `INSERT INTO users (name, email, role)
       VALUES ('Bilal Siddiqui', 'pro@test.com', 'CLIENT') RETURNING id`
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

    // 4. Create PCOS Client (Amina Shah - pcos@test.com)
    console.log('Creating PCOS Client...');
    const pcosUser = await db.query(
      `INSERT INTO users (name, email, role)
       VALUES ('Amina Shah', 'pcos@test.com', 'CLIENT') RETURNING id`
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

    await db.query(
      `INSERT INTO progress_logs (user_id, log_date, weight, waist_cm, energy_score, mood_score, workouts_completed, ai_insight)
       VALUES ($1, CURRENT_DATE, 68.2, 82.5, 4, 4, 1, 'Adherence drop: completed only 1 of 3 workouts. High fatigue.')`,
      [pcosId]
    );

    await db.query(
      `INSERT INTO escalation_alerts (user_id, type, severity, details)
       VALUES ($1, 'COMPLIANCE', 'MEDIUM', 'Compliance failure: User completed only 1 of 3 workouts this week.')`,
      [pcosId]
    );

    console.log('Loading parsed clients from JSON...');
    const parsedPath = 'C:\\Users\\Arshian\\.gemini\\antigravity\\brain\\83019531-d861-4ccc-9385-8e9da52faad3\\scratch\\parsed_clients.json';
    const clientsData = JSON.parse(fs.readFileSync(parsedPath, 'utf8'));
    console.log(`Loaded ${clientsData.length} clients. Seeding into DB...`);

    for (const c of clientsData) {
      // Insert user
      const userRes = await db.query(
        `INSERT INTO users (name, email, role)
         VALUES ($1, $2, 'CLIENT') RETURNING id`,
        [c.name, c.email]
      );
      const userId = userRes.rows[0].id;

      // Insert health profile
      await db.query(
        `INSERT INTO health_profiles (
          user_id, age, gender, weight, height, conditions, medications, cycle_status,
          stress_level, sleep_hours, adherence_probability, recovery_score, coaching_complexity,
          diet_strictness_tolerance, cooking_control, location, occupation, equipment_access,
          home_or_gym, chai_cups, water_glasses, sleep_consistency, anxiety_depression,
          bloodwork_status, supplement_comfort, contact_number, end_goal_description,
          workout_timing, workout_duration, smoking_status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          'MODERATE', 'FULL', 'Pakistan', $14, $15, $16, $17, $18,
          'CONSISTENT', 'NO', 'NEVER', $19, NULL, $20, 'EVENING', '45-60', 'NO'
        )`,
        [
          userId, c.age, c.gender, c.weight, c.height, c.conditions, c.medications, c.cycle_status,
          c.stress_level, c.sleep_hours, c.adherence_probability, c.recovery_score, c.coaching_complexity,
          c.occupation, c.equipment_access, c.home_or_gym, c.chai_cups, c.water_glasses,
          c.supplement_comfort, c.end_goal_description
        ]
      );

      // Generate plans using recommendation Engine
      const profileInfo = { recoveryScore: c.recovery_score };
      const onboardingInfo = {
        conditions: c.conditions,
        experience: c.experience,
        home_or_gym: c.home_or_gym,
        equipment_access: c.equipment_access
      };
      
      const workoutPlan = generateWorkoutPlan(userId, profileInfo, onboardingInfo);
      
      const nutritionInfo = {
        age: c.age,
        gender: c.gender,
        weight: c.weight,
        height: c.height,
        goal: c.goal,
        chai_cups: c.chai_cups
      };
      const nutritionPlan = generateNutritionPlan(userId, {}, nutritionInfo);

      // Insert workout plan
      await db.query(
        `INSERT INTO workout_plans (user_id, split, frequency, exercises, progression_scheme, generated_by, version)
         VALUES ($1, $2, $3, $4, $5, 'AI', 1)`,
        [userId, workoutPlan.split, workoutPlan.frequency, JSON.stringify(workoutPlan.exercises), workoutPlan.progression_scheme]
      );

      // Insert nutrition plan
      await db.query(
        `INSERT INTO nutrition_plans (user_id, calories, protein, carbs, fats, meal_templates)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, nutritionPlan.calories, nutritionPlan.protein, nutritionPlan.carbs, nutritionPlan.fats, JSON.stringify(nutritionPlan.meal_templates)]
      );

      // If user has high complexity and medical conditions, add an alert
      if (c.coaching_complexity === 'HIGH' && c.conditions[0] !== 'None') {
        const severity = c.conditions.includes('Diabetes') || c.conditions.includes('Eating disorder') ? 'URGENT' : 'HIGH';
        await db.query(
          `INSERT INTO escalation_alerts (user_id, type, severity, details)
           VALUES ($1, 'MEDICAL', $2, $3)`,
          [userId, severity, `System flagged client ${c.name} due to active conditions: ${c.conditions.join(', ')}.`]
        );
      }
    }

    console.log('\nSeeding completed successfully!');
  } catch (err) {
    console.error('Seeding failed with error:', err.message);
  } finally {
    process.exit(0);
  }
}

seedExcelData();
