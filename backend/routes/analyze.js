const express = require('express');
const multer = require('multer');
const axios = require('axios');
const { verifyToken } = require('../middleware/auth');
const Analysis = require('../models/Analysis');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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

    // Wake up ML service — retry up to 10x with 8s gaps (Render free tier cold start can take ~60-90s)
    const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    let mlReady = false;
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        await axios.get(`${ML_URL}/health`, { timeout: 15000 });
        console.log(`ML service ready on attempt ${attempt}`);
        mlReady = true;
        break;
      } catch (e) {
        console.warn(`ML warm-up attempt ${attempt}/10: ${e.message}`);
        if (attempt < 10) await new Promise(r => setTimeout(r, 8000));
      }
    }
    if (!mlReady) {
      return res.status(503).json({ error: 'ML service is taking longer than usual to start up. Please wait 60 seconds and try again.' });
    }

    const mlResponse = await axios.post(
      `${ML_URL}/analyze`,
      form,
      { headers: form.getHeaders(), timeout: 150000 }
    );

    const mlData = mlResponse.data;

    // Upload to Cloudinary
    let pdf_url = '';
    try {
      if (process.env.CLOUDINARY_CLOUD_NAME) {
        const uploadPdfToCloudinary = (buffer, filename) => {
          return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { resource_type: 'raw', type: 'upload', access_mode: 'public', public_id: `resumes/${uid}/${Date.now()}-${filename}` },
              (error, result) => {
                if (result) resolve(result.secure_url);
                else reject(error);
              }
            );
            streamifier.createReadStream(buffer).pipe(stream);
          });
        };
        pdf_url = await uploadPdfToCloudinary(req.file.buffer, req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'));
      } else {
        throw new Error('Cloudinary credentials not configured in .env');
      }
    } catch (err) {
      console.error('Cloudinary upload error, falling back to local storage:', err.message);
      const fs = require('fs');
      const path = require('path');
      const uploadDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
      const fileName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      fs.writeFileSync(path.join(uploadDir, fileName), req.file.buffer);
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
      pdf_url = `${backendUrl}/uploads/${fileName}`;
    }

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
      section_scores: mlData.section_scores || {},
      pdf_url,
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
    // Return proxy URL so browser never hits Cloudinary directly
    const result = analysis.toObject();
    if (result.pdf_url) {
      result.pdf_proxy_url = `/api/pdf/${analysis._id}`;
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pdf/:id - Proxy the PDF through our backend
router.get('/pdf/:id', verifyToken, async (req, res) => {
  try {
    const analysis = await Analysis.findOne({ _id: req.params.id, uid: req.user.uid });
    if (!analysis || !analysis.pdf_url) return res.status(404).json({ error: 'PDF not found' });

    const pdfUrl = analysis.pdf_url;

    // If it's a local file, serve it directly
    if (pdfUrl.startsWith('http://localhost') || pdfUrl.startsWith('http://127.0.0.1')) {
      const path = require('path');
      const urlPath = new URL(pdfUrl).pathname; // e.g. /uploads/filename.pdf
      const filePath = path.join(__dirname, '..', urlPath);
      return res.sendFile(filePath);
    }

    // Otherwise fetch from Cloudinary (or any remote URL) and stream it
    const https = require('https');
    const http = require('http');
    const protocol = pdfUrl.startsWith('https') ? https : http;
    protocol.get(pdfUrl, (stream) => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      stream.pipe(res);
    }).on('error', (e) => {
      console.error('PDF proxy error:', e.message);
      res.status(500).json({ error: 'Could not fetch PDF' });
    });
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
