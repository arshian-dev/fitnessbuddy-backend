const express = require('express');
const router = express.Router();
const db = require('../db/db');

// GET /api/coach/roster - Get all active client profiles, plans, progress, and alerts for a specific coach
router.get('/roster', async (req, res) => {
  const coachId = req.query.coachId;
  
  if (!coachId) {
    return res.status(400).json({ error: 'Coach ID is required.' });
  }

  try {
    // 1. Get all clients assigned to this coach
    const clientsRes = await db.query(
      "SELECT id, name, email, created_at FROM users WHERE role = 'CLIENT' AND assigned_coach_id = $1 ORDER BY created_at DESC",
      [coachId]
    );
    const clients = clientsRes.rows;

    const roster = [];

    // 2. Fetch details for each client
    for (const client of clients) {
      const profileRes = await db.query('SELECT * FROM health_profiles WHERE user_id = $1', [client.id]);
      const workoutRes = await db.query(
        'SELECT * FROM workout_plans WHERE user_id = $1 ORDER BY version DESC LIMIT 1',
        [client.id]
      );
      const nutritionRes = await db.query(
        'SELECT * FROM nutrition_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [client.id]
      );
      const checkinRes = await db.query(
        'SELECT * FROM progress_logs WHERE user_id = $1 ORDER BY log_date DESC LIMIT 1',
        [client.id]
      );
      const alertsRes = await db.query(
        'SELECT * FROM escalation_alerts WHERE user_id = $1 AND resolved = false ORDER BY created_at DESC',
        [client.id]
      );

      // Determine priority score based on active alerts
      let maxSeverity = 'NONE';
      const activeAlerts = alertsRes.rows || [];
      if (activeAlerts.length > 0) {
        const severities = activeAlerts.map(a => a.severity.toUpperCase());
        if (severities.includes('URGENT')) maxSeverity = 'URGENT';
        else if (severities.includes('HIGH')) maxSeverity = 'HIGH';
        else if (severities.includes('MEDIUM')) maxSeverity = 'MEDIUM';
        else maxSeverity = 'LOW';
      }

      roster.push({
        ...client,
        profile: profileRes.rows[0] || null,
        workoutPlan: workoutRes.rows[0] || null,
        nutritionPlan: nutritionRes.rows[0] || null,
        latestCheckin: checkinRes.rows[0] || null,
        activeAlerts,
        maxSeverity,
      });
    }

    // Sort roster: URGENT first, then HIGH, MEDIUM, LOW, and finally NONE
    const severityOrder = { 'URGENT': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3, 'NONE': 4 };
    roster.sort((a, b) => severityOrder[a.maxSeverity] - severityOrder[b.maxSeverity]);

    res.json(roster);
  } catch (err) {
    console.error('Error fetching coach roster:', err.message);
    res.status(500).json({ error: 'Failed to fetch coach roster.' });
  }
});

// POST /api/plans/override - Coach overrides workout or nutrition plans
router.post('/override', async (req, res) => {
  const { userId, type, details } = req.body;

  if (!userId || !type || !details) {
    return res.status(400).json({ error: 'User ID, type, and details are required.' });
  }

  try {
    if (type === 'workout') {
      const { split, frequency, exercises, progression_scheme } = details;

      // Find current latest version
      const lastPlan = await db.query(
        'SELECT version FROM workout_plans WHERE user_id = $1 ORDER BY version DESC LIMIT 1',
        [userId]
      );
      const nextVersion = lastPlan.rowCount > 0 ? lastPlan.rows[0].version + 1 : 1;

      const result = await db.query(
        `INSERT INTO workout_plans (user_id, split, frequency, exercises, progression_scheme, generated_by, version)
         VALUES ($1, $2, $3, $4, $5, 'COACH', $6) RETURNING *`,
        [userId, split, parseInt(frequency), JSON.stringify(exercises), progression_scheme, nextVersion]
      );

      return res.json({ success: true, workoutPlan: result.rows[0] });

    } else if (type === 'nutrition') {
      const { calories, protein, carbs, fats, meal_templates } = details;

      const result = await db.query(
        `INSERT INTO nutrition_plans (user_id, calories, protein, carbs, fats, meal_templates)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [userId, parseInt(calories), parseInt(protein), parseInt(carbs), parseInt(fats), JSON.stringify(meal_templates)]
      );

      return res.json({ success: true, nutritionPlan: result.rows[0] });
    } else {
      return res.status(400).json({ error: 'Invalid plan type.' });
    }
  } catch (err) {
    console.error('Error overriding plan:', err.message);
    res.status(500).json({ error: 'Failed to override plan.' });
  }
});

// POST /api/coach/resolve-alert - Resolve escalation alert
router.post('/resolve-alert', async (req, res) => {
  const { alertId } = req.body;

  if (!alertId) {
    return res.status(400).json({ error: 'Alert ID is required.' });
  }

  try {
    await db.query('UPDATE escalation_alerts SET resolved = true WHERE id = $1', [alertId]);
    res.json({ success: true, message: 'Alert resolved successfully.' });
  } catch (err) {
    console.error('Error resolving alert:', err.message);
    res.status(500).json({ error: 'Failed to resolve alert.' });
  }
});

// GET /api/coach/exercises - Retrieve exercise library
router.get('/exercises', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM exercises_library ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching exercise library:', err.message);
    res.status(500).json({ error: 'Failed to fetch exercise library.' });
  }
});

// POST /api/coach/exercises - Add new exercise to library
router.post('/exercises', async (req, res) => {
  const { name, category } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Exercise name is required.' });
  }
  try {
    const result = await db.query(
      'INSERT INTO exercises_library (name, category) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category RETURNING *',
      [name.trim(), category || 'General']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error creating exercise:', err.message);
    res.status(500).json({ error: 'Failed to create exercise.' });
  }
});

// GET /api/coach/foods - Retrieve food library
router.get('/foods', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM food_library ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching food library:', err.message);
    res.status(500).json({ error: 'Failed to fetch food library.' });
  }
});

// POST /api/coach/foods - Add new food to library
router.post('/foods', async (req, res) => {
  const { name, calories, protein, carbs, fats, serving_unit } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Food name is required.' });
  }
  try {
    const result = await db.query(
      `INSERT INTO food_library (name, calories, protein, carbs, fats, serving_unit)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (name) DO UPDATE SET 
         calories = EXCLUDED.calories,
         protein = EXCLUDED.protein,
         carbs = EXCLUDED.carbs,
         fats = EXCLUDED.fats,
         serving_unit = EXCLUDED.serving_unit
       RETURNING *`,
      [name.trim(), parseInt(calories) || 0, parseFloat(protein) || 0.0, parseFloat(carbs) || 0.0, parseFloat(fats) || 0.0, serving_unit || '100g']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error creating food item:', err.message);
    res.status(500).json({ error: 'Failed to create food item.' });
  }
});

// POST /api/plans/revert - Revert client's workout plan to latest COACH-prescribed version
router.post('/revert', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    // Find the latest plan generated by 'COACH'
    let coachPlanRes = await db.query(
      "SELECT * FROM workout_plans WHERE user_id = $1 AND generated_by = 'COACH' ORDER BY version DESC, created_at DESC LIMIT 1",
      [userId]
    );

    if (coachPlanRes.rowCount === 0) {
      // Fallback to onboarding plan (version 1)
      coachPlanRes = await db.query(
        "SELECT * FROM workout_plans WHERE user_id = $1 AND version = 1 LIMIT 1",
        [userId]
      );
    }

    if (coachPlanRes.rowCount === 0) {
      return res.status(404).json({ error: "No coach-prescribed or baseline plans found for this user." });
    }

    const coachPlan = coachPlanRes.rows[0];

    // Find current latest version of any plan for this user
    const lastPlan = await db.query(
      'SELECT version FROM workout_plans WHERE user_id = $1 ORDER BY version DESC LIMIT 1',
      [userId]
    );
    const nextVersion = lastPlan.rowCount > 0 ? lastPlan.rows[0].version + 1 : 1;

    // Create a new version of the coach plan
    const result = await db.query(
      `INSERT INTO workout_plans (user_id, split, frequency, exercises, progression_scheme, generated_by, version)
       VALUES ($1, $2, $3, $4, $5, 'COACH', $6) RETURNING *`,
      [
        userId,
        coachPlan.split,
        coachPlan.frequency,
        typeof coachPlan.exercises === 'string' ? coachPlan.exercises : JSON.stringify(coachPlan.exercises),
        coachPlan.progression_scheme,
        nextVersion
      ]
    );

    res.json({ success: true, workoutPlan: result.rows[0] });
  } catch (err) {
    console.error('Error reverting plan:', err.message);
    res.status(500).json({ error: 'Failed to revert plan.' });
  }
});

// DELETE /api/coach/clients/:id - Remove a client and all associated data
router.delete('/clients/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Delete user (cascade will handle related records in profiles, plans, logs, alerts, etc.)
    const result = await db.query('DELETE FROM users WHERE id = $1 AND role = $2 RETURNING id', [id, 'CLIENT']);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Client not found.' });
    }
    
    res.json({ success: true, message: 'Client removed successfully.' });
  } catch (err) {
    console.error('Error removing client:', err.message);
    res.status(500).json({ error: 'Failed to remove client.' });
  }
});

module.exports = router;
