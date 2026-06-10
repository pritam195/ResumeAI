import os
from dotenv import load_dotenv
load_dotenv()

key = os.getenv('GOOGLE_GEMINI_API_KEY') or os.getenv('GEMINI_API_KEY')
has_key = bool(key)
prefix = key[:8] if key else 'MISSING'
print(f'API key found: {has_key} | prefix: {prefix}')

try:
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=key)
    response = client.models.generate_content(
        model='gemini-2.0-flash',
        contents='Say hello in one word. Return only JSON: {"feedback": "hello", "suggestions": []}',
        config=types.GenerateContentConfig(max_output_tokens=50)
    )
    print(f'Gemini OK: {response.text}')
except Exception as e:
    print(f'Gemini ERROR: {type(e).__name__}: {e}')
