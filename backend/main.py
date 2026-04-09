import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import uuid
import requests 
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import List
import shutil
import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

# Local application imports
from parser import parse_resume
from database import save_candidate, collection
from report_generator import generate_pdf_report

# ======================================================
# 🔑 API CONFIGURATION (Secure .env Loading)
# ======================================================
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("⚠️ No API Key found! Make sure you have a .env file with GEMINI_API_KEY set.")

genai.configure(api_key=api_key)

app = FastAPI(title="AI Resume Scanner & Job Recommender", version="12.0 - Gemini 2.5 Upgrade")

# ======================================================
# CORS CONFIGURATION
# ======================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = [".pdf", ".docx"]

def validate_file(filename: str):
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are supported."
        )

# ======================================================
# 🧠 GEMINI LLM ROLE PREDICTION & ATS ENGINE
# ======================================================
def analyze_resume_roles(extracted_skills, top_n=3):
    if not extracted_skills:
        return [{
            "predicted_role": "Software Engineer",
            "ats_score": 50,
            "matched_skills": [],
            "missing_skills": ["Python", "SQL", "Git"]
        }]

    prompt = f"""
    You are an expert IT Recruiter and ATS system. 
    A candidate has the following skills: {', '.join(extracted_skills)}
    
    Predict the top {top_n} best-fitting tech job roles for this candidate. 
    For each role, calculate a realistic ATS match score (0-100) based on industry standards.
    Identify which of their skills match the role, and list 3-5 core industry skills they are missing.
    
    Return the result strictly as a raw JSON array of objects. Do not include markdown formatting like ```json.
    Use this exact structure:
    [
      {{
        "predicted_role": "Role Name",
        "ats_score": 85,
        "matched_skills": ["Skill1", "Skill2"],
        "missing_skills": ["Missing1", "Missing2"]
      }}
    ]
    """
    
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        # BULLETPROOF JSON CLEANER
        raw_text = response.text.replace("```json", "").replace("```", "").strip()
        start_idx = raw_text.find('[')
        end_idx = raw_text.rfind(']')
        
        if start_idx != -1 and end_idx != -1:
            clean_text = raw_text[start_idx:end_idx+1]
        else:
            clean_text = raw_text
            
        ai_results = json.loads(clean_text)
        return ai_results

    except Exception as e:
        print(f"⚠️ AI API Error: {e}")
        error_msg = str(e).replace('"', "'")[:60]
        return [{
            "predicted_role": f"API Error (Check Key): {error_msg}",
            "ats_score": 0,
            "matched_skills": [],
            "missing_skills": ["Generate a NEW API Key", "Paste in main.py", "Restart Server"]
        }]

# ======================================================
# ☁️ CLOUD LIVE JOB FETCHER
# ======================================================
def fetch_live_jobs(role, location="Bengaluru, India"):
    try:
        print(f"☁️ Fetching live internet jobs for: {role} in India...")
        
        search_term = "software"
        if "Data" in role: search_term = "data"
        elif "Machine Learning" in role: search_term = "machine learning"
        elif "DevOps" in role: search_term = "devops"
        elif "Security" in role: search_term = "security"
        elif "Cloud" in role: search_term = "cloud"
        elif "Backend" in role: search_term = "backend"
        elif "Frontend" in role: search_term = "frontend"
        elif "Developer" in role: search_term = "developer"

        # URL Markdown fix
        url = f"[https://remotive.com/api/remote-jobs?search=](https://remotive.com/api/remote-jobs?search=){search_term}&limit=20"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        jobs = []
        
        if "jobs" in data and len(data["jobs"]) > 0:
            for job in data["jobs"]:
                loc = str(job.get("candidate_required_location", "")).lower()
                if "india" in loc or "worldwide" in loc or "anywhere" in loc or "global" in loc:
                    jobs.append({
                        "title": job.get("title", role),
                        "company": job.get("company_name", "Tech Company"),
                        "location": "🇮🇳 Remote / India",
                        "link": job.get("url", "#") 
                    })
                    
                    if len(jobs) == 3: 
                        break
        
        if len(jobs) < 3:
            encoded_role = role.replace(" ", "%20")
            naukri_role = role.replace(" ", "-").lower()
            
            fallbacks = [
                {
                    "title": f"{role} (Actively Hiring)", 
                    "company": "LinkedIn India", 
                    "location": "🇮🇳 Bengaluru / Remote", 
                    "link": f"[https://www.linkedin.com/jobs/search/?keywords=](https://www.linkedin.com/jobs/search/?keywords=){encoded_role}&location=India"
                },
                {
                    "title": f"{role} - Tech Roles", 
                    "company": "Naukri.com", 
                    "location": "🇮🇳 India", 
                    "link": f"[https://www.naukri.com/](https://www.naukri.com/){naukri_role}-jobs-in-india"
                },
                {
                    "title": f"Senior {role}", 
                    "company": "Indeed India", 
                    "location": "🇮🇳 Remote India", 
                    "link": f"[https://in.indeed.com/jobs?q=](https://in.indeed.com/jobs?q=){encoded_role}&l=India"
                }
            ]
            
            for fb in fallbacks:
                if len(jobs) < 3:
                    jobs.append(fb)
                else:
                    break
                    
        return jobs
        
    except Exception as e:
        print(f"API Error: {e}")
        encoded_role = role.replace(" ", "%20")
        naukri_role = role.replace(" ", "-").lower()
        return [
            {"title": f"{role}", "company": "LinkedIn", "location": "🇮🇳 India", "link": f"[https://www.linkedin.com/jobs/search/?keywords=](https://www.linkedin.com/jobs/search/?keywords=){encoded_role}&location=India"},
            {"title": f"{role}", "company": "Naukri", "location": "🇮🇳 India", "link": f"[https://www.naukri.com/](https://www.naukri.com/){naukri_role}-jobs-in-india"},
            {"title": f"{role}", "company": "Indeed", "location": "🇮🇳 India", "link": f"[https://in.indeed.com/jobs?q=](https://in.indeed.com/jobs?q=){encoded_role}&l=India"}
        ]

# ======================================================
# API ROUTES
# ======================================================
@app.get("/")
def home():
    return {"message": "AI Resume Recommender Backend Running"}

@app.get("/health")
def health_check():
    return {"status": "OK"}

@app.post("/upload_resume/")
async def upload_resume(files: List[UploadFile] = File(...)):
    try:
        results = []
        collection.delete_many({})

        for file in files:
            validate_file(file.filename)
            file_path = os.path.join(UPLOAD_FOLDER, file.filename)
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            parsed = parse_resume(file_path)
            os.remove(file_path)

            extracted_skills = parsed.get("skills", [])
            
            if not extracted_skills:
                extracted_skills = ["Python", "Problem Solving"] 

            top_career_paths = analyze_resume_roles(extracted_skills, top_n=3)

            for path in top_career_paths:
                path["recommended_jobs"] = fetch_live_jobs(path["predicted_role"])

            primary_role = top_career_paths[0]["predicted_role"]
            primary_ats = top_career_paths[0]["ats_score"]

            candidate_data = {
                "filename": file.filename,
                "skills": extracted_skills,
                "primary_predicted_role": primary_role,
                "primary_ats_score": primary_ats, 
                "career_paths": top_career_paths, 
                "uploaded_at": datetime.utcnow().isoformat()
            }
            save_candidate(candidate_data)

            results.append({
                "filename": file.filename,
                "extracted_skills": extracted_skills,
                "career_paths": top_career_paths 
            })

        return {"batch_results": results}

    except Exception as e:
        print(f"Upload Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/rank_candidates")
def rank_candidates():
    candidates = list(collection.find({}, {"_id": 0}))
    return candidates

@app.get("/analytics")
def analytics():
    candidates = list(collection.find({}, {"_id": 0}))
    if not candidates:
        return {"total_resumes": 0}

    all_skills = []
    for c in candidates:
        all_skills.extend(c.get("skills", []))
    
    skill_counts = {}
    for skill in all_skills:
        skill_counts[skill] = skill_counts.get(skill, 0) + 1
        
    top_skills = sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "total_resumes": len(candidates),
        "top_skills": top_skills,
    }

@app.post("/generate_report/")
async def generate_report(data: dict):
    try:
        filename = data.get("filename")
        if not filename:
            raise HTTPException(status_code=400, detail="Filename required")

        safe_name = filename.replace(" ", "_").replace("/", "")
        output_file = os.path.join(UPLOAD_FOLDER, f"{safe_name}_report.pdf")

        generate_pdf_report(data, output_file)

        if not os.path.exists(output_file):
            raise HTTPException(status_code=500, detail="PDF not generated")

        return FileResponse(
            path=output_file,
            media_type="application/pdf",
            filename=f"{safe_name}_Report.pdf"
        )
    except Exception as e:
        print("PDF ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)