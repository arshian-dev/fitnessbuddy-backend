const express = require('express');
const router = express.Router();
const db = require('../db/db');

// POST /api/checkins - Log weekly check-in
router.post('/', async (req, res) => {
  const {
    userId,
    log_date,
    weight,
    waist_cm,
    energy_score,
    mood_score,
    workout_completed = false,
    calories_logged = 0,
    protein_logged = 0,
    carbs_logged = 0,
    fats_logged = 0,
    photo_uris = []
  } = req.body;

  if (!userId || !weight) {
    return res.status(400).json({ error: 'User ID and weight are required.' });
  }

  try {
    // 1. Fetch user's profile and active workout plan to generate insights/alerts
    const profileRes = await db.query('SELECT * FROM health_profiles WHERE user_id = $1', [userId]);
    const planRes = await db.query(
      'SELECT * FROM workout_plans WHERE user_id = $1 ORDER BY version DESC LIMIT 1',
      [userId]
    );

    const startingWeight = profileRes.rowCount > 0 ? profileRes.rows[0].weight : weight;
    const planFrequency = planRes.rowCount > 0 ? planRes.rows[0].frequency : 3;

    // Fetch previous logs
    const prevLogsRes = await db.query(
      'SELECT * FROM progress_logs WHERE user_id = $1 ORDER BY log_date DESC LIMIT 2',
      [userId]
    );

    // 2. Generate Smart Progress Insight
    let weightDiff = 0;
    let comparisonText = '';
    const currentWeight = parseFloat(weight);

    if (prevLogsRes.rowCount > 0) {
      const prevWeight = parseFloat(prevLogsRes.rows[0].weight);
      weightDiff = Math.round((currentWeight - prevWeight) * 100) / 100;
      if (weightDiff < 0) {
        comparisonText = `down ${Math.abs(weightDiff)} kg since last week.`;
      } else if (weightDiff > 0) {
        comparisonText = `up ${weightDiff} kg since last week.`;
      } else {
        comparisonText = 'stable since last week.';
      }
    } else {
      weightDiff = Math.round((currentWeight - startingWeight) * 100) / 100;
      if (weightDiff < 0) {
        comparisonText = `down ${Math.abs(weightDiff)} kg since starting onboarding.`;
      } else if (weightDiff > 0) {
        comparisonText = `up ${weightDiff} kg since starting onboarding.`;
      } else {
        comparisonText = 'identical to starting weight.';
      }
    }

    let workoutComment = '';
    if (workout_completed) {
      workoutComment = `Great job completing your workout today!`;
    } else {
      workoutComment = `No workout logged today, remember consistency is key!`;
    }

    let wellnessComment = '';
    if (parseInt(energy_score) <= 4 || parseInt(mood_score) <= 4) {
      wellnessComment = `Energy or mood levels are running low. Make sure you are prioritizing recovery, hydration, and aim for 7-8 hours of sleep.`;
    } else {
      wellnessComment = `Energy and mood are looking strong, supporting optimal recovery.`;
    }

    const aiInsight = `Weight is ${comparisonText} ${workoutComment} ${wellnessComment}`;

    // 3. Save progress log
    // Handles ON CONFLICT on (user_id, log_date) so user can overwrite their check-in for today
    const logResult = await db.query(
      `INSERT INTO progress_logs (user_id, log_date, weight, waist_cm, energy_score, mood_score, workout_completed, calories_logged, protein_logged, carbs_logged, fats_logged, photo_uris, ai_insight)
       VALUES ($1, COALESCE($2::DATE, CURRENT_DATE), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (user_id, log_date) DO UPDATE SET
         weight = EXCLUDED.weight,
         waist_cm = EXCLUDED.waist_cm,
         energy_score = EXCLUDED.energy_score,
         mood_score = EXCLUDED.mood_score,
         workout_completed = EXCLUDED.workout_completed,
         calories_logged = EXCLUDED.calories_logged,
         protein_logged = EXCLUDED.protein_logged,
         carbs_logged = EXCLUDED.carbs_logged,
         fats_logged = EXCLUDED.fats_logged,
         photo_uris = EXCLUDED.photo_uris,
         ai_insight = EXCLUDED.ai_insight
       RETURNING *`,
      [
        userId,
        log_date || null,
        currentWeight,
        waist_cm ? parseFloat(waist_cm) : null,
        parseInt(energy_score),
        parseInt(mood_score),
        Boolean(workout_completed),
        parseInt(calories_logged) || 0,
        parseInt(protein_logged) || 0,
        parseInt(carbs_logged) || 0,
        parseInt(fats_logged) || 0,
        photo_uris,
        aiInsight
      ]
    );

    // 4. Evaluate Escalation Alerts
    let triggeredAlerts = [];

    // Trigger A: Compliance Failure
    // Example: If energy and mood are low, we can't reliably calculate weekly compliance here without grouping by week.
    // For now, we will just look at psychological risk and plateaus.

    // Trigger B: Psychological Risk / Extreme Burnout
    if (parseInt(energy_score) <= 3 && parseInt(mood_score) <= 3) {
      const alert = await db.query(
        `INSERT INTO escalation_alerts (user_id, type, severity, details)
         VALUES ($1, 'PSYCHOLOGICAL', 'HIGH', $2) RETURNING *`,
        [userId, `Burnout indicator: User reported very low energy (${energy_score}/10) and mood (${mood_score}/10) concurrently.`]
      );
      triggeredAlerts.push(alert.rows[0]);
    }

    // Trigger C: Weight Plateau Detection
    // Requires at least 2 previous logs + current log (total 3 consecutive logs)
    if (prevLogsRes.rowCount >= 2) {
      const log1 = currentWeight;
      const log2 = parseFloat(prevLogsRes.rows[0].weight);
      const log3 = parseFloat(prevLogsRes.rows[1].weight);

      const diff1 = Math.abs(log1 - log2);
      const diff2 = Math.abs(log2 - log3);

      // If weight changes less than 0.2kg over 3 logs (2 intervals)
      if (diff1 <= 0.2 && diff2 <= 0.2) {
        const alert = await db.query(
          `INSERT INTO escalation_alerts (user_id, type, severity, details)
           VALUES ($1, 'PLATEAU', 'MEDIUM', $2) RETURNING *`,
          [userId, `Plateau detected: Weight remained stable (${log3}kg -> ${log2}kg -> ${log1}kg) for 3 consecutive logs.`]
        );
        triggeredAlerts.push(alert.rows[0]);
      }
    }

    res.status(201).json({
      success: true,
      log: logResult.rows[0],
      alerts: triggeredAlerts
    });

  } catch (err) {
    console.error('Error logging check-in:', err.message);
    res.status(500).json({ error: 'Failed to submit check-in.' });
  }
});

// GET /api/checkins/:userId - Get all progress logs
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await db.query(
      'SELECT * FROM progress_logs WHERE user_id = $1 ORDER BY log_date DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching check-ins:', err.message);
    res.status(500).json({ error: 'Failed to fetch check-in logs.' });
  }
});

module.exports = router;
