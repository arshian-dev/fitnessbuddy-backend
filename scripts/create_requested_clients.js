const db = require('../db/db');
const { computeProfile } = require('../services/profilingEngine');
const { generateWorkoutPlan, generateNutritionPlan } = require('../services/recommendationEngine');

async function createRequestedClients() {
  console.log('Starting creation of requested clients (Rozain, Nuqta, Provit, Numa)...');

  try {
    // 1. Get Coach details
    const coachRes = await db.query("SELECT id, trainer_id FROM users WHERE email = 'coach@test.com' AND role = 'COACH' LIMIT 1");
    if (coachRes.rowCount === 0) {
      console.error('Test coach (coach@test.com) not found in the database. Please ensure DB is initialized.');
      process.exit(1);
    }
    const coachId = coachRes.rows[0].id;
    const trainerId = coachRes.rows[0].trainer_id;

    console.log(`Found Coach with ID: ${coachId}, Trainer ID: ${trainerId}`);

    const clientsToCreate = [
      {
        name: 'Rozain',
        email: 'rozain@test.com',
        onboarding: {
          age: 28,
          gender: 'MALE',
          weight: 76.0,
          height: 176.0,
          conditions: [],
          medications: false,
          cycleStatus: 'NOT_APPLICABLE',
          stressLevel: 'MEDIUM',
          sleepHours: 7.5,
          dietStrictnessTolerance: 'MODERATE',
          cookingControl: 'FULL',
          location: 'Pakistan',
          occupation: 'Software Engineer',
          equipmentAccess: ['All gym machines', 'Free weights'],
          homeOrGym: 'GYM',
          chaiCups: 1,
          waterGlasses: 10,
          sleepConsistency: 'CONSISTENT',
          anxietyDepression: 'NO',
          bloodworkStatus: 'HAD_IT_NORMAL',
          supplementComfort: true,
          contactNumber: '+923001112233',
          endGoalDescription: 'Build lean muscle mass and improve overall strength',
          workoutTiming: 'EVENING',
          workoutDuration: '60',
          smokingStatus: 'NO',
          goal: 'MUSCLE_GAIN'
        }
      },
      {
        name: 'Nuqta',
        email: 'nuqta@test.com',
        onboarding: {
          age: 26,
          gender: 'FEMALE',
          weight: 69.0,
          height: 162.0,
          conditions: ['PCOS'],
          medications: false,
          cycleStatus: 'IRREGULAR',
          stressLevel: 'HIGH',
          sleepHours: 6.5,
          dietStrictnessTolerance: 'FLEXIBLE',
          cookingControl: 'PARTIAL',
          location: 'Pakistan',
          occupation: 'Designer',
          equipmentAccess: ['Free weights', 'Resistance bands'],
          homeOrGym: 'HOME',
          chaiCups: 2,
          waterGlasses: 8,
          sleepConsistency: 'IRREGULAR',
          anxietyDepression: 'MILD_SYMPTOMS',
          bloodworkStatus: 'NEVER',
          supplementComfort: true,
          contactNumber: '+923004445566',
          endGoalDescription: 'Balance hormonal health, manage PCOS symptoms, and lose body fat safely',
          workoutTiming: 'MORNING',
          workoutDuration: '45',
          smokingStatus: 'NO',
          goal: 'FAT_LOSS'
        }
      },
      {
        name: 'Provit',
        email: 'provit@test.com',
        onboarding: {
          age: 30,
          gender: 'MALE',
          weight: 82.0,
          height: 180.0,
          conditions: [],
          medications: false,
          cycleStatus: 'NOT_APPLICABLE',
          stressLevel: 'LOW',
          sleepHours: 8.0,
          dietStrictnessTolerance: 'STRICT',
          cookingControl: 'FULL',
          location: 'UAE/Gulf',
          occupation: 'Business Analyst',
          equipmentAccess: ['All gym machines', 'Free weights', 'Cable machines'],
          homeOrGym: 'GYM',
          chaiCups: 1,
          waterGlasses: 12,
          sleepConsistency: 'CONSISTENT',
          anxietyDepression: 'NO',
          bloodworkStatus: 'HAD_IT_NORMAL',
          supplementComfort: true,
          contactNumber: '+971501112233',
          endGoalDescription: 'Improve athletic performance, stamina, and maintain low body fat',
          workoutTiming: 'EVENING',
          workoutDuration: '60-90',
          smokingStatus: 'NO',
          goal: 'RECOMP'
        }
      },
      {
        name: 'Numa',
        email: 'numa@test.com',
        onboarding: {
          age: 25,
          gender: 'FEMALE',
          weight: 64.0,
          height: 165.0,
          conditions: [],
          medications: false,
          cycleStatus: 'REGULAR',
          stressLevel: 'MEDIUM',
          sleepHours: 7.0,
          dietStrictnessTolerance: 'MODERATE',
          cookingControl: 'FULL',
          location: 'Pakistan',
          occupation: 'Healthcare Professional',
          equipmentAccess: ['Free weights', 'Cable machines'],
          homeOrGym: 'GYM',
          chaiCups: 1,
          waterGlasses: 9,
          sleepConsistency: 'CONSISTENT',
          anxietyDepression: 'NO',
          bloodworkStatus: 'HAD_IT_NORMAL',
          supplementComfort: true,
          contactNumber: '+923007778899',
          endGoalDescription: 'Tone body, build sustainable healthy eating habits, and improve energy levels',
          workoutTiming: 'EVENING',
          workoutDuration: '45-60',
          smokingStatus: 'NO',
          goal: 'FAT_LOSS'
        }
      }
    ];

    for (const client of clientsToCreate) {
      console.log(`\nProcessing client: ${client.name} (${client.email})...`);

      // Check if user already exists
      let userRes = await db.query('SELECT * FROM users WHERE email = $1', [client.email]);
      let userId;

      if (userRes.rowCount > 0) {
        userId = userRes.rows[0].id;
        console.log(`Client ${client.name} already exists with ID: ${userId}. Updating assignment to coach...`);
        await db.query(
          'UPDATE users SET name = $1, role = $2, assigned_coach_id = $3, trainer_id = $4 WHERE id = $5',
          [client.name, 'CLIENT', coachId, trainerId, userId]
        );
      } else {
        const insertUser = await db.query(
          `INSERT INTO users (trainer_id, name, email, role, assigned_coach_id)
           VALUES ($1, $2, $3, 'CLIENT', $4) RETURNING *`,
          [trainerId, client.name, client.email, coachId]
        );
        userId = insertUser.rows[0].id;
        console.log(`Created user ${client.name} with ID: ${userId}`);
      }

      // Compute profile scores
      const computed = computeProfile(client.onboarding);

      // Save/update health profile
      await db.query(
        `INSERT INTO health_profiles (
          user_id, age, gender, weight, height, conditions, medications, cycle_status, 
          stress_level, sleep_hours, adherence_probability, recovery_score, 
          coaching_complexity, diet_strictness_tolerance, cooking_control,
          location, occupation, equipment_access, home_or_gym, chai_cups, water_glasses,
          sleep_consistency, anxiety_depression, bloodwork_status, supplement_comfort,
          contact_number, end_goal_description, workout_timing, workout_duration, smoking_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
        ON CONFLICT (user_id) DO UPDATE SET
          age = EXCLUDED.age,
          gender = EXCLUDED.gender,
          weight = EXCLUDED.weight,
          height = EXCLUDED.height,
          conditions = EXCLUDED.conditions,
          medications = EXCLUDED.medications,
          cycle_status = EXCLUDED.cycle_status,
          stress_level = EXCLUDED.stress_level,
          sleep_hours = EXCLUDED.sleep_hours,
          adherence_probability = EXCLUDED.adherence_probability,
          recovery_score = EXCLUDED.recovery_score,
          coaching_complexity = EXCLUDED.coaching_complexity,
          diet_strictness_tolerance = EXCLUDED.diet_strictness_tolerance,
          cooking_control = EXCLUDED.cooking_control,
          location = EXCLUDED.location,
          occupation = EXCLUDED.occupation,
          equipment_access = EXCLUDED.equipment_access,
          home_or_gym = EXCLUDED.home_or_gym,
          chai_cups = EXCLUDED.chai_cups,
          water_glasses = EXCLUDED.water_glasses,
          sleep_consistency = EXCLUDED.sleep_consistency,
          anxiety_depression = EXCLUDED.anxiety_depression,
          bloodwork_status = EXCLUDED.bloodwork_status,
          supplement_comfort = EXCLUDED.supplement_comfort,
          contact_number = EXCLUDED.contact_number,
          end_goal_description = EXCLUDED.end_goal_description,
          workout_timing = EXCLUDED.workout_timing,
          workout_duration = EXCLUDED.workout_duration,
          smoking_status = EXCLUDED.smoking_status`,
        [
          userId,
          client.onboarding.age,
          client.onboarding.gender,
          client.onboarding.weight,
          client.onboarding.height,
          client.onboarding.conditions,
          client.onboarding.medications,
          client.onboarding.cycleStatus,
          client.onboarding.stressLevel,
          client.onboarding.sleepHours,
          computed.adherenceProbability,
          computed.recoveryScore,
          computed.coachingComplexity,
          client.onboarding.dietStrictnessTolerance,
          client.onboarding.cookingControl,
          client.onboarding.location,
          client.onboarding.occupation,
          client.onboarding.equipmentAccess,
          client.onboarding.homeOrGym,
          client.onboarding.chaiCups,
          client.onboarding.waterGlasses,
          client.onboarding.sleepConsistency,
          client.onboarding.anxietyDepression,
          client.onboarding.bloodworkStatus,
          client.onboarding.supplementComfort,
          client.onboarding.contactNumber,
          client.onboarding.endGoalDescription,
          client.onboarding.workoutTiming,
          client.onboarding.workoutDuration,
          client.onboarding.smokingStatus
        ]
      );

      // Delete existing plans if re-running
      await db.query('DELETE FROM workout_plans WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM nutrition_plans WHERE user_id = $1', [userId]);

      // Generate Workout & Nutrition Plans
      const workoutPlan = generateWorkoutPlan(userId, computed, client.onboarding);
      const nutritionPlan = generateNutritionPlan(userId, computed, { ...client.onboarding, goal: client.onboarding.goal });

      await db.query(
        `INSERT INTO workout_plans (user_id, split, frequency, exercises, progression_scheme, generated_by, version)
         VALUES ($1, $2, $3, $4, $5, 'AI', 1)`,
        [userId, workoutPlan.split, workoutPlan.frequency, JSON.stringify(workoutPlan.exercises), workoutPlan.progression_scheme]
      );

      await db.query(
        `INSERT INTO nutrition_plans (user_id, calories, protein, carbs, fats, meal_templates)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, nutritionPlan.calories, nutritionPlan.protein, nutritionPlan.carbs, nutritionPlan.fats, JSON.stringify(nutritionPlan.meal_templates)]
      );

      // Create an initial progress log entry
      await db.query(
        `INSERT INTO progress_logs (user_id, log_date, weight, waist_cm, energy_score, mood_score, workouts_completed, ai_insight)
         VALUES ($1, CURRENT_DATE, $2, $3, 8, 8, 1, 'Initial onboarding complete. Plan assigned.')
         ON CONFLICT (user_id, log_date) DO NOTHING`,
        [userId, client.onboarding.weight, client.onboarding.gender === 'MALE' ? 88.0 : 80.0]
      );

      console.log(`Successfully setup profile, workout plan, and nutrition plan for ${client.name}.`);
    }

    console.log('\nAll 4 requested clients (Rozain, Nuqta, Provit, Numa) have been created and assigned to Coach Noroze Sikandar (coach@test.com)!');
    process.exit(0);
  } catch (err) {
    console.error('Error creating clients:', err);
    process.exit(1);
  }
}

createRequestedClients();
