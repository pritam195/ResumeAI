const express = require('express');
const { verifyToken } = require('../middleware/auth');
const Analysis = require('../models/Analysis');
const router = express.Router();

// GET /api/history - fetch user's analysis history
router.get('/history', verifyToken, async (req, res) => {
  try {
    const analyses = await Analysis.find({ uid: req.user.uid })
      .sort({ created_at: -1 })
      .select('-resume_text') // exclude large text field
      .limit(50);
    res.json({ analyses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
