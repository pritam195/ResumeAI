const express = require('express');
const multer = require('multer');
const axios = require('axios');
const { verifyToken } = require('../middleware/auth');
const Analysis = require('../models/Analysis');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/analyze
router.post('/analyze', verifyToken, upload.single('resume'), async (req, res) => {
  try {
    const { job_description } = req.body;
    const uid = req.user.uid;

    if (!req.file) return res.status(400).json({ error: 'No resume file uploaded' });
    if (!job_description?.trim()) return res.status(400).json({ error: 'Job description is required' });

    // Forward PDF + JD to Python ML service
    const FormData = require('form-data');
    const form = new FormData();
    form.append('resume', req.file.buffer, {
      filename: req.file.originalname,
      contentType: 'application/pdf',
    });
    form.append('job_description', job_description);

    const mlResponse = await axios.post(
      `${process.env.ML_SERVICE_URL || 'http://localhost:8000'}/analyze`,
      form,
      { headers: form.getHeaders(), timeout: 120000 }
    );

    const mlData = mlResponse.data;

    // Save to MongoDB
    const analysis = new Analysis({
      uid,
      resume_text: mlData.resume_text,
      job_description,
      skills: mlData.skills || [],
      matched_skills: mlData.skill_gap?.matched || [],
      missing_skills: mlData.skill_gap?.missing || [],
      extra_skills: mlData.skill_gap?.extra || [],
      skill_categories: mlData.skill_categories || {},
      jd_categories: mlData.jd_categories || {},
      resume_quality: mlData.resume_quality || {},
      score: mlData.weighted_score?.final_score || 0,
      breakdown: mlData.weighted_score?.breakdown || {},
      similarity_score: mlData.similarity_score || 0,
      feedback: mlData.llm_insights?.feedback || '',
      suggestions: mlData.llm_insights?.suggestions || [],
    });

    await analysis.save();
    res.json({ analysisId: analysis._id, score: analysis.score });
  } catch (err) {
    console.error('Analyze error:', err.message);
    const status = err.response?.status || 500;
    const msg = err.response?.data?.error || err.message || 'Analysis failed';
    res.status(status).json({ error: msg });
  }
});

// GET /api/result/:id
router.get('/result/:id', verifyToken, async (req, res) => {
  try {
    const analysis = await Analysis.findOne({ _id: req.params.id, uid: req.user.uid });
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/result/:id
router.delete('/result/:id', verifyToken, async (req, res) => {
  try {
    const analysis = await Analysis.findOneAndDelete({ _id: req.params.id, uid: req.user.uid });
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
