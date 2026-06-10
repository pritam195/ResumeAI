import sys
import io

# Force UTF-8 on Windows (avoids charmap codec errors with emoji in logs)
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
from dotenv import load_dotenv
load_dotenv()  # Load .env before any os.getenv() calls

from modules.text_extractor  import extract_text_from_pdf
from modules.skill_extractor import extract_skills, extract_skills_detailed
from modules.semantic_matcher import compute_similarity
from modules.scorer          import compute_weighted_score, compute_skill_gap
from modules.llm_insights    import get_llm_insights
from modules.resume_quality  import analyze_resume_quality

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'version': '2.0'})


@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        # ── 1. Validate input ─────────────────────────────────────────────
        if 'resume' not in request.files:
            return jsonify({'error': 'No resume file provided'}), 400

        resume_file     = request.files['resume']
        job_description = request.form.get('job_description', '').strip()

        # Read PDF bytes ONCE — reused by text extractor & quality analyzer
        pdf_bytes = resume_file.read()
        if not pdf_bytes:
            return jsonify({'error': 'Empty file uploaded'}), 400

        # ── 2. Extract text ───────────────────────────────────────────────
        logger.info("[1/7] Extracting text from PDF...")
        resume_text = extract_text_from_pdf(io.BytesIO(pdf_bytes))
        if not resume_text or len(resume_text) < 50:
            return jsonify({'error': 'Could not extract text. Ensure the PDF has selectable text (not a scanned image).'}), 400

        # ── 3. Skill extraction ───────────────────────────────────────────
        logger.info("[2/7] Extracting & canonicalizing skills...")
        resume_detailed   = extract_skills_detailed(resume_text)
        resume_skills     = resume_detailed["skills"]
        resume_categories = resume_detailed["by_category"]

        if job_description:
            jd_detailed   = extract_skills_detailed(job_description)
            jd_skills     = jd_detailed["skills"]
            jd_categories = jd_detailed["by_category"]
        else:
            jd_skills     = []
            jd_categories = {}

        # ── 4. Semantic similarity ────────────────────────────────────────
        logger.info("[3/7] Computing semantic similarity...")
        similarity_score = compute_similarity(resume_text, job_description) if job_description else 0.0

        # ── 5. Skill gap ──────────────────────────────────────────────────
        logger.info("[4/7] Computing skill gap...")
        skill_gap = compute_skill_gap(resume_skills, jd_skills)

        # ── 6. Multi-dimensional resume quality ───────────────────────────
        logger.info("[5/7] Running 10-dimension quality analysis...")
        quality_report = analyze_resume_quality(resume_text, pdf_bytes)

        # ── 7. Composite weighted score ───────────────────────────────────
        logger.info("[6/7] Computing composite weighted score...")
        weighted_score = compute_weighted_score(
            skill_gap        = skill_gap,
            similarity_score = similarity_score,
            resume_text      = resume_text,
            job_description  = job_description,
            quality_score    = quality_report['overall'],
        )

        # ── 8. Gemini AI insights ─────────────────────────────────────────
        logger.info("[7/7] Generating Gemini AI insights...")
        llm_insights = get_llm_insights(
            resume_text     = resume_text,
            job_description = job_description,
            score           = weighted_score['final_score'],
            missing_skills  = skill_gap['missing'],
            matched_skills  = skill_gap['matched'],
        )

        # ── 9. Build response ─────────────────────────────────────────────
        result = {
            # Core
            'resume_text':        resume_text[:3000],
            'skills':             resume_skills,
            'skill_categories':   resume_categories,   # NEW: categorized breakdown
            'jd_skills':          jd_skills,
            'jd_categories':      jd_categories,       # NEW: categorized JD skills

            # Skill gap
            'skill_gap':          skill_gap,
            'similarity_score':   round(similarity_score, 4),

            # Scores
            'weighted_score':     weighted_score,

            # Quality breakdown
            'resume_quality':     quality_report,

            # AI insights
            'llm_insights':       llm_insights,
        }

        logger.info(f"Analysis complete. Final score: {weighted_score['final_score']}/100")
        return jsonify(result)

    except Exception as e:
        logger.error(f"Analysis error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
