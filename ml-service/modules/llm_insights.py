"""
llm_insights.py
---------------
AI-powered resume feedback via Google Gemini or OpenAI.

Improvements over v1:
- Resume/JD context increased to 4000/3000 chars (Gemini supports 128K).
- _parse_json_response validates the parsed dict has required keys before
  returning; falls through to rule-based on malformed output.
- Retry with exponential backoff (2 attempts, 2s delay) on 429 rate limits.
- Gemini model order: gemini-2.5-flash first (most capable), then 2.0-flash,
  then 2.0-flash-lite (highest quota).
- _rule_based_insights now receives resume_text and job_description and
  references actual skills/terms from them in its output.
"""

import os
import re
import json
import time
import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)


def get_llm_insights(
    resume_text:     str,
    job_description: str,
    score:           int,
    missing_skills:  List[str],
    matched_skills:  List[str],
) -> Dict:
    """
    Get AI feedback using Google Gemini API (or OpenAI as fallback).
    Returns structured, personalized feedback and suggestions.
    """
    prompt     = _build_prompt(resume_text, job_description, score, missing_skills, matched_skills)
    gemini_key = os.getenv("GOOGLE_GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")

    result = None

    if gemini_key:
        try:
            result = _call_gemini(prompt, gemini_key)
        except Exception as e:
            logger.warning("Gemini failed, falling back: %s", e)

    if result is None and openai_key:
        try:
            result = _call_openai(prompt, openai_key)
        except Exception as e:
            logger.warning("OpenAI failed, falling back: %s", e)

    if result is None:
        result = _rule_based_insights(
            score, missing_skills, matched_skills,
            resume_text=resume_text,
            job_description=job_description,
        )

    # Ensure suggestions is always a list of strings
    if not isinstance(result.get("suggestions"), list):
        result["suggestions"] = []
    result["suggestions"] = [str(s) for s in result["suggestions"]][:6]

    return result


# ── Prompt builder ─────────────────────────────────────────────────────────────

def _build_prompt(
    resume_text: str,
    jd:          str,
    score:       int,
    missing:     List[str],
    matched:     List[str],
) -> str:
    missing_str = ", ".join(missing[:20]) if missing else "None"
    matched_str = ", ".join(matched[:20]) if matched else "None"

    # Increased from 2000/1500 → 4000/3000 chars
    return f"""You are a senior ATS consultant and technical recruiter.
Analyze this specific resume against this specific job description and give PERSONALIZED advice.

=== RESUME ===
{resume_text[:4000]}

=== JOB DESCRIPTION ===
{jd[:3000]}

=== ATS ANALYSIS RESULTS ===
ATS Match Score: {score}/100
Matched Skills: {matched_str}
Missing Skills: {missing_str}

=== YOUR TASK ===
The candidate is applying for this job IMMEDIATELY and does not have time to learn new skills, take courses, or build new projects. 
Your suggestions must focus STRICTLY on editing and optimizing their existing resume.

Provide a JSON response with this exact structure:
{{
  "feedback": "A punchy, 2-sentence maximum personalized analysis of their current fit.",
  "suggestions": [
    "Hidden Skills: Identify 1-2 missing JD skills they likely possess based on their experience. Keep this under 2 short sentences.",
    "Wording Improvements: Provide exactly one concrete example of how to rephrase a specific bullet point. Keep it extremely punchy and under 2 sentences.",
    "Keyword Coverage: List 3-4 exact-match keywords they should add. Keep it under 2 sentences."
  ]
}}

IMPORTANT RULES:
- NEVER suggest taking courses, learning new tools, or building new projects.
- ALWAYS make suggestions actionable right now.
- BE EXTREMELY CONCISE. Each suggestion must be a maximum of 2 short sentences. Absolutely no fluff or overly long paragraphs.
- Return ONLY valid JSON."""


# ── Gemini caller ──────────────────────────────────────────────────────────────

def _call_gemini(prompt: str, api_key: str) -> Dict:
    """
    Call Google Gemini API using the new google-genai SDK (HTTP/REST transport).

    Uses google-genai >= 1.0.0 which does NOT depend on gRPC/cygrpc,
    fixing the Python 3.13 compatibility issue with the old google-generativeai SDK.

    Model order: most capable first. Retries once with 2s backoff on 429.
    """
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise RuntimeError(
            "google-genai package not installed. Run: pip install google-genai>=1.0.0"
        )

    client = genai.Client(api_key=api_key)

    # Most capable → highest free-tier quota
    models_to_try = [
        "gemini-2.0-flash",
        "gemini-2.5-flash",
        "gemini-2.0-flash-lite",
    ]

    last_error = None
    for model_name in models_to_try:
        for attempt in range(2):   # up to 2 attempts per model
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.3,
                        response_mime_type="application/json",
                    ),
                )
                text = response.text.strip()
                logger.info(
                    "Gemini response via %s (%d chars)", model_name, len(text)
                )
                return _parse_json_response(text)

            except Exception as e:
                err_str = str(e).lower()
                if "429" in err_str or "resource_exhausted" in err_str or "quota" in err_str:
                    if attempt == 0:
                        logger.warning(
                            "%s rate-limited (429) — retrying in 2s...", model_name
                        )
                        time.sleep(2)
                        continue
                logger.warning("%s failed: %s", model_name, e)
                last_error = e
                break   # try next model

    raise RuntimeError(f"All Gemini models failed. Last error: {last_error}")


# ── OpenAI caller ──────────────────────────────────────────────────────────────

def _call_openai(prompt: str, api_key: str) -> Dict:
    """Call OpenAI GPT API with retry on rate limit."""
    from openai import OpenAI
    client = OpenAI(api_key=api_key)

    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert ATS consultant. Always respond with valid JSON only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=1200,
                response_format={"type": "json_object"},
            )
            text = response.choices[0].message.content
            return _parse_json_response(text)

        except Exception as e:
            err_str = str(e).lower()
            if ("429" in err_str or "rate" in err_str) and attempt == 0:
                logger.warning("OpenAI rate-limited — retrying in 2s...")
                time.sleep(2)
                continue
            logger.error("OpenAI error: %s", e)
            raise


# ── JSON parser ────────────────────────────────────────────────────────────────

def _parse_json_response(text: str) -> Dict:
    """
    Robustly parse JSON from LLM response.
    Validates that the result has the expected shape before returning.
    Falls through to rule-based if the response is malformed.
    """
    # Strip markdown code fences
    text = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
    text = re.sub(r"\s*```$",          "", text.strip(), flags=re.MULTILINE)
    text = text.strip()

    parsed = None
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group())
            except Exception:
                pass

    if parsed is None:
        logger.warning("LLM response could not be parsed as JSON. RAW: %s", repr(text))
        return None   # caller will fall through to rule-based

    # Validate required shape
    feedback    = parsed.get("feedback", "")
    suggestions = parsed.get("suggestions", [])

    if not isinstance(feedback, str) or len(feedback.strip()) < 10:
        logger.warning("LLM response missing valid 'feedback' field — using rule-based.")
        return None

    if not isinstance(suggestions, list):
        suggestions = []

    return {"feedback": feedback, "suggestions": suggestions}


# ── Rule-based fallback ────────────────────────────────────────────────────────

def _rule_based_insights(
    score:           int,
    missing:         List[str],
    matched:         List[str],
    resume_text:     str = "",
    job_description: str = "",
) -> Dict:
    """
    Fallback rule-based insights when no LLM API is available.

    Improvement: extracts actual terms from resume_text and job_description
    to make the feedback less generic.
    """
    # Extract top meaningful words from resume and JD for personalisation
    def _top_words(text: str, n: int = 5) -> List[str]:
        words = re.findall(r"\b[a-zA-Z][a-zA-Z0-9+#.]{2,}\b", text.lower())
        common = {"the", "and", "for", "are", "was", "with", "that", "this",
                  "from", "have", "been", "will", "your", "using", "also"}
        freq   = {}
        for w in words:
            if w not in common:
                freq[w] = freq.get(w, 0) + 1
        return sorted(freq, key=freq.get, reverse=True)[:n]

    resume_terms = _top_words(resume_text) if resume_text else []
    jd_terms     = _top_words(job_description) if job_description else []

    # Personalise feedback with actual terms when available
    resume_ctx = f" (including {', '.join(resume_terms)})" if resume_terms else ""
    jd_ctx     = f" (key focus areas: {', '.join(jd_terms)})" if jd_terms else ""

    if score >= 80:
        feedback = (
            f"Your resume is a strong match for this position with a score of {score}/100{resume_ctx}. "
            f"You've demonstrated proficiency in {len(matched)} key skills the employer is looking for{jd_ctx}. "
            "Minor gaps exist but your overall profile is very competitive."
        )
    elif score >= 60:
        feedback = (
            f"Your resume shows a moderate match ({score}/100) for this position{resume_ctx}. "
            f"You have relevant experience in {len(matched)} key areas, but there are "
            f"{len(missing)} important skills missing{jd_ctx}. "
            "Targeted improvements can significantly boost your score."
        )
    else:
        feedback = (
            f"Your resume currently scores {score}/100 for this position{resume_ctx}, "
            "indicating significant skill gaps. "
            f"While you have {len(matched)} matching skills, the role requires "
            f"{len(missing)} additional competencies{jd_ctx} you should address before applying."
        )

    suggestions = []
    if missing:
        top_missing = ", ".join(missing[:5])
        suggestions.append(
            f"Hidden Skills: Review your past experience to see if you have implicitly used any of these missing skills: {top_missing}. If so, mention them explicitly in your project descriptions."
        )
        suggestions.append(
            f"Wording Improvements: Ensure your experience bullet points actively reflect the JD's requirements. If you've solved similar problems, rephrase your bullets to highlight those specific challenges rather than just listing tasks."
        )

    if jd_terms:
        suggestions.append(
            f"Keyword Coverage: Consider incorporating keywords such as {', '.join(jd_terms[:4])} into your resume where they accurately describe your experience. ATS systems prioritize exact matches."
        )
    else:
        suggestions.append(
            "Keyword Coverage: Copy key phrases from the job description verbatim into your resume. ATS systems do exact keyword matching — synonyms don't always count."
        )

    suggestions.append(
        "Impact Focus: Quantify your achievements wherever possible (e.g., 'increased efficiency by 20%', 'managed $50K budget') to provide concrete, measurable impact."
    )

    return {"feedback": feedback, "suggestions": suggestions[:6]}
