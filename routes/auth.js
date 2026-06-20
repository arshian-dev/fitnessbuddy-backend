const express = require('express');
const router = express.Router();
const db = require('../db/db');

// Register a new user
router.post('/register', async (req, res) => {
  const { name, email, role, coachCode } = req.body;

  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Name, email, and role are required.' });
  }

  try {
    // Check if user already exists
    const existing = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      return res.json(existing.rows[0]);
    }

    let generatedCoachCode = null;
    let assignedCoachId = null;

    if (role.toUpperCase() === 'COACH') {
      // Generate a random 6-character alphanumeric coach code
      generatedCoachCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    } else if (role.toUpperCase() === 'CLIENT' && coachCode) {
      // Lookup the coach by code
      const coachRes = await db.query("SELECT id FROM users WHERE role = 'COACH' AND coach_code = $1", [coachCode.trim().toUpperCase()]);
      if (coachRes.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid Coach Invite Code.' });
      }
      assignedCoachId = coachRes.rows[0].id;
    }

    const result = await db.query(
      'INSERT INTO users (name, email, role, coach_code, assigned_coach_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, email, role.toUpperCase(), generatedCoachCode, assignedCoachId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found. Please register.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
