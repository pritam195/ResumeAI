const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  uid: { type: String, required: true, index: true },
  resume_text: { type: String },
  job_description: { type: String, required: true },
  skills: [String],
  matched_skills: [String],
  missing_skills: [String],
  extra_skills: [String],
  skill_categories: { type: Map, of: [String] },
  jd_categories: { type: Map, of: [String] },
  resume_quality: { type: mongoose.Schema.Types.Mixed },
  score: { type: Number, required: true },
  section_scores: { type: Map, of: Number },
  pdf_url: { type: String },
  breakdown: {
    core: Number,
    secondary: Number,
    experience: Number,
    quality: Number,
  },
  similarity_score: { type: Number },
  feedback: { type: String },
  suggestions: [String],
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Analysis', analysisSchema);
