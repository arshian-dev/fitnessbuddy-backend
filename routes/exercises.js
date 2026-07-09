const express = require('express');
const router = express.Router();
const wgerService = require('../services/wgerService');

// GET /api/exercises/search?q=squat
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'Missing query parameter "q"' });
    }

    const results = await wgerService.searchWger(query);
    // Limit to top 15 results for the frontend to filter for media
    res.json({ results: results.slice(0, 15) });
  } catch (error) {
    console.error('Error searching wger exercises:', error);
    res.status(500).json({ error: 'Failed to search exercises' });
  }
});

module.exports = router;
