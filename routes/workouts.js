const express = require('express');
const router = express.Router();
const db = require('../db/db');

// POST /api/workouts/routines - Save a routine template
router.post('/routines', async (req, res) => {
    try {
        const { userId, name, exercises } = req.body;
        if (!userId || !name || !exercises) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = await db.query(
            `INSERT INTO routines (user_id, name, exercises) VALUES ($1, $2, $3) RETURNING *`,
            [userId, name, JSON.stringify(exercises)]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error saving routine:', err);
        res.status(500).json({ error: 'Failed to save routine' });
    }
});

// GET /api/workouts/routines/:userId - Get all user routines
router.get('/routines/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await db.query(
            `SELECT * FROM routines WHERE user_id = $1 ORDER BY created_at DESC`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching routines:', err);
        res.status(500).json({ error: 'Failed to fetch routines' });
    }
});

// GET /api/workouts/history/:userId/:exerciseId - Get the last logged set details for ghost values
router.get('/history/:userId/:exerciseId', async (req, res) => {
    try {
        const { userId, exerciseId } = req.params;
        const result = await db.query(
            `SELECT weight, reps FROM workout_logs 
             WHERE user_id = $1 AND exercise_id = $2 
             ORDER BY created_at DESC LIMIT 1`,
            [userId, exerciseId]
        );
        res.json(result.rows[0] || null);
    } catch (err) {
        console.error('Error fetching history:', err);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

const { computeProfile } = require('../services/profilingEngine');
const { generateWorkoutPlan } = require('../services/recommendationEngine');

// POST /api/workouts/change-split - Change client's workout split manually
router.post('/change-split', async (req, res) => {
    try {
        const { userId, splitKey } = req.body;
        if (!userId || !splitKey) {
            return res.status(400).json({ error: 'User ID and splitKey are required' });
        }

        // Fetch user health profile if available
        const profileRes = await db.query('SELECT * FROM health_profiles WHERE user_id = $1', [userId]);
        const healthProfile = profileRes.rowCount > 0 ? profileRes.rows[0] : {};

        // Compute scores
        const computed = computeProfile(healthProfile);

        // Generate workout plan with explicit splitKey
        const newPlan = generateWorkoutPlan(userId, computed, healthProfile, splitKey);

        // Delete existing workout plan and insert new one
        await db.query('DELETE FROM workout_plans WHERE user_id = $1', [userId]);
        const insertRes = await db.query(
            `INSERT INTO workout_plans (user_id, split, frequency, exercises, progression_scheme, generated_by, version)
             VALUES ($1, $2, $3, $4, $5, 'CLIENT', 1) RETURNING *`,
            [userId, newPlan.split, newPlan.frequency, JSON.stringify(newPlan.exercises), newPlan.progression_scheme]
        );

        res.status(200).json(insertRes.rows[0]);
    } catch (err) {
        console.error('Error changing workout split:', err);
        res.status(500).json({ error: 'Failed to change workout split' });
    }
});

module.exports = router;
