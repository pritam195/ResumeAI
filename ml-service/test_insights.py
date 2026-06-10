from modules.llm_insights import get_llm_insights
import logging
import sys
from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.INFO, stream=sys.stdout)

resume_text = "I am a software engineer with 5 years of experience in Python, React, and Node.js. I have built several web applications and deployed them to AWS."
jd = "Looking for a Full Stack Developer with strong React and Node.js skills. Must have experience with cloud platforms like AWS or GCP. Knowledge of Docker is a plus."

score = 85
missing = ["Docker", "GCP"]
matched = ["React", "Node.js", "AWS"]

res = get_llm_insights(resume_text, jd, score, missing, matched)
print("FINAL RESULT:")
print(res)
