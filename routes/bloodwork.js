const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db/db');
const { OpenAI } = require('openai');
// Reuse Mammoth and PDF-parse from assetProcessor if possible, or require them directly
const mammoth = require('mammoth');
const pdf = require('pdf-parse/lib/pdf-parse.js');
const { processTextAndSave } = require('../services/assetProcessor');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// POST /api/bloodwork/upload - Upload and analyze bloodwork
router.post('/upload', upload.single('file'), async (req, res) => {
  const { userId, logDate } = req.body;
  const file = req.file;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  if (!file) {
    return res.status(400).json({ error: 'Please provide a file to upload.' });
  }

  try {
    let textData = '';
    const mimeType = file.mimetype;
    const originalName = file.originalname;

    if (mimeType === 'application/pdf' || originalName.endsWith('.pdf')) {
      const data = await pdf(file.buffer);
      textData = data.text;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || originalName.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      textData = result.value;
    } else if (mimeType.startsWith('text/') || originalName.endsWith('.txt') || originalName.endsWith('.md')) {
      textData = file.buffer.toString('utf8');
    } else {
      return res.status(400).json({ error: 'Unsupported file format. Please upload PDF, DOCX, or TXT.' });
    }

    if (!textData || textData.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract text from the document.' });
    }

    // Call AI to analyze the bloodwork
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o';
    
    const prompt = `You are an expert endocrinologist and medical analyst working for "Fitness Buddy".
Please analyze the following raw text extracted from a blood test/lab report.
Identify key biomarkers (e.g., Vitamin D, Iron/Ferritin, HbA1c, Fasting Glucose, Testosterone, Thyroid TSH/T3/T4, Lipid panel).
Return a concise summary formatted in Markdown, highlighting any out-of-range values, deficiencies, and what it means for fitness, recovery, or diet.
If the document does not appear to be a lab report, simply state that no valid bloodwork data was found.

Raw Document Text:
"""
${textData.substring(0, 15000)}
"""`;

    let aiAnalysisSummary = "Analysis failed or no API keys available.";

    // Try OpenAI first
    if (openaiApiKey && openaiApiKey !== 'your_openai_api_key_here') {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`
          },
          body: JSON.stringify({
            model: openaiModel,
            messages: [{ role: 'user', content: prompt }]
          })
        });

        const json = await response.json();
        if (json.choices && json.choices[0] && json.choices[0].message) {
          aiAnalysisSummary = json.choices[0].message.content.trim();
        }
      } catch (err) {
        console.error('OpenAI analysis failed, trying Gemini fallback...', err.message);
      }
    }
    
    // Try Gemini as fallback if OpenAI failed or not configured
    if (aiAnalysisSummary === "Analysis failed or no API keys available." && geminiApiKey && geminiApiKey !== 'your_gemini_api_key_here') {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }]
          })
        });

        const json = await response.json();
        if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0]) {
          aiAnalysisSummary = json.candidates[0].content.parts[0].text.trim();
        }
      } catch (err) {
        console.error('Gemini fallback analysis failed:', err.message);
      }
    }

    // Strip markdown code block wrappers if the AI included them
    aiAnalysisSummary = aiAnalysisSummary.replace(/^```markdown\n?/i, '').replace(/```$/i, '').trim();

    // Save to database
    const queryDate = logDate || new Date().toISOString().split('T')[0];
    const result = await db.query(
      `INSERT INTO bloodwork_logs (user_id, log_date, file_name, ai_analysis_summary)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, queryDate, originalName, aiAnalysisSummary]
    );

    // Optional: Add to Knowledge Base if the user has a trainer
    try {
      const userRes = await db.query('SELECT trainer_id FROM users WHERE id = $1', [userId]);
      if (userRes.rowCount > 0 && userRes.rows[0].trainer_id) {
        const trainerId = userRes.rows[0].trainer_id;
        // Prefix source with "Bloodwork: " to keep it organized
        await processTextAndSave(trainerId, 'BLOODWORK', `Bloodwork: ${originalName} (User: ${userId})`, aiAnalysisSummary);
      }
    } catch (e) {
      console.error('Could not save bloodwork to knowledge base:', e.message);
    }

    // Update profile bloodwork status
    await db.query(`UPDATE health_profiles SET bloodwork_status = 'COMPLETED' WHERE user_id = $1`, [userId]);

    return res.json({ 
      success: true, 
      message: 'Bloodwork uploaded and analyzed successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Bloodwork Upload Error:', error);
    return res.status(500).json({ error: 'Failed to process bloodwork: ' + error.message });
  }
});

// GET /api/bloodwork/:userId - Get bloodwork history
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await db.query(
      `SELECT * FROM bloodwork_logs WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch Bloodwork Error:', error);
    res.status(500).json({ error: 'Failed to fetch bloodwork history' });
  }
});

module.exports = router;
