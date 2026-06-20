const express = require('express');
const router = express.Router();
const db = require('../db/db');

// POST /api/checkins - Log weekly check-in
router.post('/', async (req, res) => {
  const {
    userId,
    weight,
    waist_cm,
    energy_score,
    mood_score,
    workouts_completed = 0,
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
    if (workouts_completed >= planFrequency) {
      workoutComment = `Excellent adherence! You completed all ${workouts_completed} scheduled workouts this week.`;
    } else if (workouts_completed >= Math.ceil(planFrequency / 2)) {
      workoutComment = `Good effort. You completed ${workouts_completed} out of ${planFrequency} workouts. Let's aim for 100% next week.`;
    } else {
      workoutComment = `Adherence drop: completed only ${workouts_completed} of ${planFrequency} workouts. Make sure to discuss any schedule issues with your coach.`;
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
      `INSERT INTO progress_logs (user_id, log_date, weight, waist_cm, energy_score, mood_score, workouts_completed, photo_uris, ai_insight)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, log_date) DO UPDATE SET
         weight = EXCLUDED.weight,
         waist_cm = EXCLUDED.waist_cm,
         energy_score = EXCLUDED.energy_score,
         mood_score = EXCLUDED.mood_score,
         workouts_completed = EXCLUDED.workouts_completed,
         photo_uris = EXCLUDED.photo_uris,
         ai_insight = EXCLUDED.ai_insight
       RETURNING *`,
      [
        userId,
        currentWeight,
        waist_cm ? parseFloat(waist_cm) : null,
        parseInt(energy_score),
        parseInt(mood_score),
        parseInt(workouts_completed),
        photo_uris,
        aiInsight
      ]
    );

    // 4. Evaluate Escalation Alerts
    let triggeredAlerts = [];

    // Trigger A: Compliance Failure
    // Completed 1 or 0 workouts when plan frequency is 3+
    if (workouts_completed <= 1 && planFrequency >= 3) {
      const alert = await db.query(
        `INSERT INTO escalation_alerts (user_id, type, severity, details)
         VALUES ($1, 'COMPLIANCE', 'MEDIUM', $2) RETURNING *`,
        [userId, `Compliance failure: User completed only ${workouts_completed} of ${planFrequency} workouts this week.`]
      );
      triggeredAlerts.push(alert.rows[0]);
    }

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

      // If weight changes less than 0.2kg over 3 logs (2 intervals), and compliance is high
      if (diff1 <= 0.2 && diff2 <= 0.2 && workouts_completed >= planFrequency - 1) {
        const alert = await db.query(
          `INSERT INTO escalation_alerts (user_id, type, severity, details)
           VALUES ($1, 'PLATEAU', 'MEDIUM', $2) RETURNING *`,
          [userId, `Plateau detected: Weight remained stable (${log3}kg -> ${log2}kg -> ${log1}kg) for 3 consecutive weeks despite high compliance.`]
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
