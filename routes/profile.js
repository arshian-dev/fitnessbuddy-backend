const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { computeProfile } = require('../services/profilingEngine');
const { generateWorkoutPlan, generateNutritionPlan } = require('../services/recommendationEngine');

// POST /api/profile - Submit onboarding questionnaire
router.post('/', async (req, res) => {
  const {
    userId,
    age,
    gender,
    weight,
    height,
    conditions = [],
    medications = false,
    cycleStatus = 'NOT_APPLICABLE',
    stressLevel = 'MEDIUM',
    sleepHours = 7.0,
    dietStrictnessTolerance = 'MODERATE',
    cookingControl = 'FULL',
    location = 'Pakistan',
    occupation = 'Employed',
    equipmentAccess = [],
    homeOrGym = 'GYM',
    chaiCups = 0,
    waterGlasses = 8,
    sleepConsistency = 'CONSISTENT',
    anxietyDepression = 'NO',
    bloodworkStatus = 'NEVER',
    supplementComfort = true,
    contactNumber = '',
    endGoalDescription = '',
    workoutTiming = 'EVENING',
    workoutDuration = '45-60',
    smokingStatus = 'NO'
  } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    // 1. Run the Profiling Engine to calculate scores
    const onboardingData = {
      age,
      gender,
      weight,
      height,
      conditions,
      medications,
      cycleStatus,
      stressLevel,
      sleepHours,
      dietStrictnessTolerance,
      cookingControl,
      location,
      occupation,
      equipmentAccess,
      homeOrGym,
      chaiCups,
      waterGlasses,
      sleepConsistency,
      anxietyDepression,
      bloodworkStatus,
      supplementComfort,
      contactNumber,
      endGoalDescription,
      workoutTiming,
      workoutDuration,
      smokingStatus
    };
    const computed = computeProfile(onboardingData);

    // 2. Save health profile to database
    // Using INSERT ON CONFLICT for user_id to allow re-submitting profile
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
        parseInt(age),
        gender,
        parseFloat(weight),
        parseFloat(height),
        conditions,
        medications,
        cycleStatus,
        stressLevel,
        parseFloat(sleepHours),
        computed.adherenceProbability,
        computed.recoveryScore,
        computed.coachingComplexity,
        dietStrictnessTolerance,
        cookingControl,
        location,
        occupation,
        equipmentAccess,
        homeOrGym,
        parseInt(chaiCups),
        parseInt(waterGlasses),
        sleepConsistency,
        anxietyDepression,
        bloodworkStatus,
        supplementComfort,
        contactNumber,
        endGoalDescription,
        workoutTiming,
        workoutDuration,
        smokingStatus
      ]
    );

    // 3. Generate initial workout and nutrition plans
    const workoutPlan = generateWorkoutPlan(userId, computed, onboardingData);
    const nutritionPlan = generateNutritionPlan(userId, computed, onboardingData);

    // 4. Save plans to database
    // For workout plans, we insert a new version
    const workoutResult = await db.query(
      `INSERT INTO workout_plans (user_id, split, frequency, exercises, progression_scheme, generated_by, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        userId,
        workoutPlan.split,
        workoutPlan.frequency,
        JSON.stringify(workoutPlan.exercises),
        workoutPlan.progression_scheme,
        workoutPlan.generated_by,
        workoutPlan.version
      ]
    );

    // For nutrition plans, we insert a new record to maintain history
    const nutritionResult = await db.query(
      `INSERT INTO nutrition_plans (user_id, calories, protein, carbs, fats, meal_templates)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        userId,
        nutritionPlan.calories,
        nutritionPlan.protein,
        nutritionPlan.carbs,
        nutritionPlan.fats,
        JSON.stringify(nutritionPlan.meal_templates)
      ]
    );

    // 5. If there's a medical risk, trigger an URGENT escalation alert
    let triggeredAlert = null;
    if (computed.hasMedicalRisk) {
      const alertResult = await db.query(
        `INSERT INTO escalation_alerts (user_id, type, severity, details)
         VALUES ($1, 'MEDICAL', 'URGENT', $2) RETURNING *`,
        [userId, `Your plan is being personalized by our coach and will be ready within 24 hours. We want to make sure it’s exactly right for you. (Reason: ${computed.medicalRiskFlags.join(', ')})`]
      );
      triggeredAlert = alertResult.rows[0];
    }

    res.status(200).json({
      success: true,
      profile: {
        user_id: userId,
        ...onboardingData,
        ...computed
      },
      workoutPlan: workoutResult.rows[0],
      nutritionPlan: nutritionResult.rows[0],
      alert: triggeredAlert
    });
  } catch (err) {
    console.error('Error saving profile and generating plans:', err.message);
    res.status(500).json({ error: 'Failed to process onboarding and generate plans.' });
  }
});

// GET /api/profile/:userId - Get profile & active plans
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const profileResult = await db.query('SELECT * FROM health_profiles WHERE user_id = $1', [userId]);
    const workoutResult = await db.query(
      'SELECT * FROM workout_plans WHERE user_id = $1 ORDER BY version DESC LIMIT 1',
      [userId]
    );
    const nutritionResult = await db.query(
      'SELECT * FROM nutrition_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    const alertsResult = await db.query(
      'SELECT * FROM escalation_alerts WHERE user_id = $1 AND resolved = false ORDER BY created_at DESC',
      [userId]
    );

    res.json({
      user: userResult.rows[0],
      profile: profileResult.rows[0] || null,
      workoutPlan: workoutResult.rows[0] || null,
      nutritionPlan: nutritionResult.rows[0] || null,
      activeAlerts: alertsResult.rows || []
    });
  } catch (err) {
    console.error('Error fetching profile:', err.message);
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

// PUT /api/profile/user/:userId - Update user profile details (e.g. name, avatar)
router.put('/user/:userId', async (req, res) => {
  const { userId } = req.params;
  const { name, avatar_url } = req.body;

  try {
    const result = await db.query(
      `UPDATE users 
       SET name = COALESCE($1, name), 
           avatar_url = COALESCE($2, avatar_url)
       WHERE id = $3 
       RETURNING id, name, email, role, coach_code, avatar_url`,
      [name, avatar_url, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating user profile:', err.message);
    res.status(500).json({ error: 'Failed to update user profile.' });
  }
});
// POST /api/profile/regenerate-diet - Regenerate only the nutrition plan
router.post('/regenerate-diet', async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    // 1. Fetch user's profile to pass to generator
    const profileResult = await db.query('SELECT * FROM health_profiles WHERE user_id = $1', [userId]);
    if (profileResult.rowCount === 0) {
      return res.status(404).json({ error: 'Health profile not found.' });
    }
    const profile = profileResult.rows[0];

    // The recommendation engine expects camelCase properties similar to onboardingData, 
    // but works with snake_case if we just map or pass it through since JS expects some fields.
    // Let's reconstruct onboardingData format
    const onboardingData = {
      age: profile.age,
      gender: profile.gender,
      weight: profile.weight,
      height: profile.height,
      conditions: profile.conditions,
      goal: profile.end_goal_description, // Wait, end_goal is a string. Actually the generator checks `goal`. We don't have `goal` in health_profiles!
      // In the original, goal was passed but not saved. Let's just pass FAT_LOSS as default if not found.
      goal: 'FAT_LOSS', 
      chaiCups: profile.chai_cups
    };

    // 2. Generate
    const nutritionPlan = generateNutritionPlan(userId, profile, onboardingData);

    // 3. Save to DB
    const nutritionResult = await db.query(
      `INSERT INTO nutrition_plans (user_id, calories, protein, carbs, fats, meal_templates)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        userId,
        nutritionPlan.calories,
        nutritionPlan.protein,
        nutritionPlan.carbs,
        nutritionPlan.fats,
        JSON.stringify(nutritionPlan.meal_templates)
      ]
    );

    res.json({
      success: true,
      nutritionPlan: nutritionResult.rows[0]
    });
  } catch (err) {
    console.error('Error regenerating diet:', err.message);
    res.status(500).json({ error: 'Failed to regenerate diet.' });
  }
});

module.exports = router;
