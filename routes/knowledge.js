const express = require('express');
const router = express.Router();
const multer = require('multer');
const { processFile, processYoutubeLink } = require('../services/assetProcessor');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max limit
});

// POST /api/knowledge/upload - Upload file or add youtube link
router.post('/upload', upload.single('file'), async (req, res) => {
  const { trainerId, youtubeUrl } = req.body;
  const file = req.file;

  if (!trainerId) {
    return res.status(400).json({ error: 'Trainer ID is required.' });
  }

  if (!file && !youtubeUrl) {
    return res.status(400).json({ error: 'Please provide either a file or a YouTube URL.' });
  }

  try {
    let results = [];
    if (file) {
      console.log(`Processing file: ${file.originalname} for trainer: ${trainerId}`);
      results = await processFile(file.buffer, file.originalname, file.mimetype, trainerId);
    } else if (youtubeUrl) {
      console.log(`Processing YouTube link: ${youtubeUrl} for trainer: ${trainerId}`);
      results = await processYoutubeLink(youtubeUrl, trainerId);
    }
    
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
