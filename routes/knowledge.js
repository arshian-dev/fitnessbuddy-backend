const express = require('express');
const router = express.Router();
const multer = require('multer');
const { processFile } = require('../services/assetProcessor');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max limit
});

// POST /api/knowledge/upload - Upload file
router.post('/upload', upload.single('file'), async (req, res) => {
  const { trainerId } = req.body; // This is actually the user.id from the frontend
  const file = req.file;

  if (!trainerId) {
    return res.status(400).json({ error: 'Trainer ID is required.' });
  }

  if (!file) {
    return res.status(400).json({ error: 'Please provide a file to upload.' });
  }

  try {
    const db = require('../db/db');
    const coachRes = await db.query('SELECT trainer_id FROM users WHERE id = $1', [trainerId]);
    const actualTrainerId = coachRes.rows[0]?.trainer_id;
    
    if (!actualTrainerId) {
      return res.status(400).json({ error: 'Coach is not linked to a trainer tenant.' });
    }

    console.log(`Processing file: ${file.originalname} for trainer: ${actualTrainerId}`);
    let results = await processFile(file.buffer, file.originalname, file.mimetype, actualTrainerId);
    
    // We return the transcripts (chunks) so the client can preview them without saving the raw file.
    const chunks = results.map(r => ({
      source_name: r.source_name,
      content: r.content
    }));

    return res.json({ 
      success: true, 
      message: 'Knowledge base updated successfully',
      chunks 
    });
  } catch (error) {
    console.error('Upload Error:', error);
    return res.status(500).json({ error: 'Failed to process asset: ' + error.message });
  }
});

module.exports = router;
