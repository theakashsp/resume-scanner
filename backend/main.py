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

from parser import parse_resume
from database import save_candidate, collection, roles_collection
from report_generator import generate_pdf_report

app = FastAPI(title="AI Resume Scanner & Job Recommender", version="6.0 - Multi-Role Cloud Edition")

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
# 🧠 DYNAMIC AI ROLE PREDICTION & ATS SCORING ENGINE
# ======================================================
def analyze_resume_roles(extracted_skills, top_n=3):
    """
    Evaluates skills against all roles by dynamically fetching them from MongoDB.
    Includes fallback protection if the database is empty.
    """
    # 1. FETCH ROLES DYNAMICALLY FROM DATABASE
    dynamic_role_database = {}
    for role_doc in roles_collection.find():
        dynamic_role_database[role_doc["role"]] = role_doc.get("skills", [])

    # 🛑 SAFETY NET: If the MongoDB collection is empty, use a fallback to prevent crashes
    if not dynamic_role_database:
        print("⚠️ WARNING: MongoDB roles database is empty! Using default fallback.")
        dynamic_role_database = {
            "Software Engineer": ["python", "java", "sql", "git", "aws", "docker"],
            "Data Analyst": ["python", "sql", "excel", "tableau", "statistics"]
        }

    if not extracted_skills:
        return [{
            "predicted_role": "Software Engineer",
            "ats_score": 50,
            "matched_skills": [],
            "missing_skills": ["Python", "SQL", "Git", "Agile"]
        }]

    user_skills_set = set([str(skill).lower() for skill in extracted_skills])
    role_results = []

    # Smart Categories (Forgiveness Logic)
    CORE_LANGUAGES = {"python", "java", "c++", "c#", "c", "javascript", "typescript", "ruby", "go"}
    FRONTEND_FW = {"react", "angular", "vue"}
    BACKEND_FW = {"node.js", "django", "fastapi", "spring boot"}
    DATABASES = {"mongodb", "sql", "postgresql", "mysql"}
    DEV_BONUS_SKILLS = {"aws", "docker", "kubernetes", "azure", "gcp"}

    # 2. LOOP THROUGH THE DYNAMIC DATABASE
    for role_name, required_skills in dynamic_role_database.items():
        req_skills_set = set([s.lower() for s in required_skills])
        
        # Calculate base intersection (matched) and difference (missing)
        matched_skills = user_skills_set.intersection(req_skills_set)
        missing_skills = req_skills_set.difference(user_skills_set)
        
        # --- Forgiveness Rules ---
        if len(req_skills_set.intersection(CORE_LANGUAGES)) > 0 and len(matched_skills.intersection(CORE_LANGUAGES)) >= 1:
            missing_skills = missing_skills - CORE_LANGUAGES
        if len(req_skills_set.intersection(FRONTEND_FW)) > 0 and len(matched_skills.intersection(FRONTEND_FW)) >= 1:
            missing_skills = missing_skills - FRONTEND_FW
        if len(req_skills_set.intersection(BACKEND_FW)) > 0 and len(matched_skills.intersection(BACKEND_FW)) >= 1:
            missing_skills = missing_skills - BACKEND_FW
        if len(req_skills_set.intersection(DATABASES)) > 0 and len(matched_skills.intersection(DATABASES)) >= 1:
            missing_skills = missing_skills - DATABASES
        if role_name not in ["Cloud Engineer", "DevOps Engineer"]:
            missing_skills = missing_skills - DEV_BONUS_SKILLS

        effective_total_skills = len(matched_skills) + len(missing_skills)
        if effective_total_skills > 0:
            match_ratio = len(matched_skills) / effective_total_skills
            ats_score = int(40 + (match_ratio * 60)) 
        else:
            ats_score = 0
            
        role_results.append({
            "predicted_role": role_name,
            "ats_score": ats_score,
            "matched_skills": [skill.title() for skill in matched_skills],
            "missing_skills": [skill.title() for skill in missing_skills]
        })

    # Sort the list by ATS score in descending order (highest first)
    role_results = sorted(role_results, key=lambda x: x["ats_score"], reverse=True)
    
    return role_results[:top_n]

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

        url = f"https://remotive.com/api/remote-jobs?search={search_term}&limit=20"
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
        
        # Fill gaps with reliable Indian Job Boards
        if len(jobs) < 3:
            encoded_role = role.replace(" ", "%20")
            naukri_role = role.replace(" ", "-").lower()
            
            fallbacks = [
                {
                    "title": f"{role} (Actively Hiring)", 
                    "company": "LinkedIn India", 
                    "location": "🇮🇳 Bengaluru / Remote", 
                    "link": f"https://www.linkedin.com/jobs/search/?keywords={encoded_role}&location=India&geoId=102713980"
                },
                {
                    "title": f"{role} - Tech Roles", 
                    "company": "Naukri.com", 
                    "location": "🇮🇳 India", 
                    "link": f"https://www.naukri.com/{naukri_role}-jobs-in-india"
                },
                {
                    "title": f"Senior {role}", 
                    "company": "Indeed India", 
                    "location": "🇮🇳 Remote India", 
                    "link": f"https://in.indeed.com/jobs?q={encoded_role}&l=India"
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
            {"title": f"{role}", "company": "LinkedIn", "location": "🇮🇳 India", "link": f"https://www.linkedin.com/jobs/search/?keywords={encoded_role}&location=India&geoId=102713980"},
            {"title": f"{role}", "company": "Naukri", "location": "🇮🇳 India", "link": f"https://www.naukri.com/{naukri_role}-jobs-in-india"},
            {"title": f"{role}", "company": "Indeed", "location": "🇮🇳 India", "link": f"https://in.indeed.com/jobs?q={encoded_role}&l=India"}
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
        collection.delete_many({}) # Clear old session data

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

            # 1. Get Top 3 Predicted Roles and their specific ATS/Gap data
            top_career_paths = analyze_resume_roles(extracted_skills, top_n=3)

            # 🛑 DOUBLE SAFETY NET: Ensure the array isn't empty before accessing index 0
            if not top_career_paths:
                top_career_paths = [{
                    "predicted_role": "Software Engineer",
                    "ats_score": 50,
                    "matched_skills": [],
                    "missing_skills": ["Python", "SQL", "Git", "Agile"]
                }]

            # 2. Fetch Live Jobs for EACH of the top roles
            for path in top_career_paths:
                path["recommended_jobs"] = fetch_live_jobs(path["predicted_role"])

            # 3. Save to Database
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

            # 4. Build Response Payload for the Frontend
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