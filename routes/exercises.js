const express = require('express');
const router = express.Router();
const db = require('../db/index');

// GET /api/exercises/search?q=squat
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'Missing query parameter "q"' });
    }

    const results = await db.query(
      'SELECT * FROM exercises_library WHERE name ILIKE $1 ORDER BY name ASC LIMIT 15',
      [`%${query}%`]
    );
    
    // Map to the format the frontend expects (or just return the rows)
    res.json({ results: results.rows });
  } catch (error) {
    console.error('Error searching local exercises:', error);
    res.status(500).json({ error: 'Failed to search exercises' });
  }
});

// GET /api/exercises (Get all exercises)
router.get('/', async (req, res) => {
  try {
    const results = await db.query('SELECT * FROM exercises_library ORDER BY name ASC');
    res.json({ results: results.rows });
  } catch (error) {
    console.error('Error fetching exercises:', error);
    res.status(500).json({ error: 'Failed to fetch exercises' });
  }
});

module.exports = router;
