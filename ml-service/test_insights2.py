import os
import sys
from dotenv import load_dotenv
load_dotenv()
from google import genai
from google.genai import types

api_key = os.getenv("GOOGLE_GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

resume_text = "I am a software engineer with 5 years of experience in Python, React, and Node.js. I have built several web applications and deployed them to AWS."
jd = "Looking for a Full Stack Developer with strong React and Node.js skills. Must have experience with cloud platforms like AWS or GCP. Knowledge of Docker is a plus."

prompt = f"""You are a senior ATS consultant and technical recruiter with 10+ years of experience.
Analyze this specific resume against this specific job description and give PERSONALIZED advice.

=== RESUME ===
{resume_text[:4000]}

=== JOB DESCRIPTION ===
{jd[:3000]}

=== ATS ANALYSIS RESULTS ===
ATS Match Score: 85/100
Matched Skills: React, Node.js, AWS
Missing Skills: Docker, GCP

=== YOUR TASK ===
Based on the ACTUAL content of the resume and JD above, provide a JSON response with this exact structure:
{{
  "feedback": "A 3-4 sentence personalized analysis. Mention the candidate's actual strengths visible in the resume, specific gaps relative to this JD, and a realistic assessment of their fit. Be specific — mention actual skills, projects, or experiences you see.",
  "suggestions": [
    "Suggestion 1: Specific, actionable advice referencing actual missing skills or JD requirements",
    "Suggestion 2: Specific advice on how to improve or reword existing resume content to better match the JD"
  ]
}}

Return ONLY valid JSON."""

print("Calling Gemini...")
response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=prompt,
    config=types.GenerateContentConfig(
        temperature=0.3,
        max_output_tokens=1500,
        response_mime_type="application/json",
    ),
)
print("FINISH REASON:", response.candidates[0].finish_reason if response.candidates else "No candidates")
print("TEXT:")
print(repr(response.text))
