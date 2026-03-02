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
from database import save_candidate, collection
from report_generator import generate_pdf_report

app = FastAPI(title="AI Resume Scanner & Job Recommender", version="5.0 - Cloud Edition")

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
# 🧠 AI ROLE PREDICTION ENGINE (DYNAMIC DICTIONARY)
# ======================================================
def predict_best_role(extracted_skills):
    if not extracted_skills:
        return "Software Engineer"
        
    skills = set([str(skill).lower() for skill in extracted_skills])
    
    # Define skill sets for expanded roles
    role_definitions = {
        "Machine Learning Engineer": {'python', 'machine learning', 'tensorflow', 'pytorch', 'data science', 'pandas', 'opencv', 'yolo'},
        "Full Stack Developer": {'react', 'javascript', 'node.js', 'html', 'css', 'fastapi', 'django'},
        "Backend Developer": {'python', 'java', 'node.js', 'sql', 'mongodb', 'django', 'fastapi', 'spring boot', 'api', 'postgresql'},
        "Frontend Developer": {'react', 'angular', 'vue', 'html', 'css', 'javascript', 'typescript', 'tailwind'},
        "Data Analyst": {'sql', 'excel', 'tableau', 'powerbi', 'data analysis', 'statistics'},
        "DevOps Engineer": {'aws', 'docker', 'kubernetes', 'linux', 'ci/cd', 'terraform', 'jenkins'},
        "Cloud Engineer": {'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'linux', 'terraform'},
        "Security Engineer": {'cybersecurity', 'penetration testing', 'ethical hacking', 'network security', 'linux', 'cryptography'},
        "Software Developer": {'c', 'java', 'c++', 'data structures', 'algorithms'}
    }

    # Calculate match score for each role
    scores = {}
    for role, required_skills in role_definitions.items():
        scores[role] = len(skills.intersection(required_skills))
        
    # Find the role with the highest score
    best_role = max(scores, key=scores.get)

    # If no match found (score is 0), default to Software Engineer
    if scores[best_role] == 0:
        return "Software Engineer"
        
    return best_role

# ======================================================
# 📊 ATS SCORING & SKILL GAP ENGINE
# ======================================================
ROLE_SKILLS_MAP = {
    "Machine Learning Engineer": ["python", "tensorflow", "pytorch", "sql", "docker", "aws", "pandas"],
    "Full Stack Developer": ["react", "node.js", "javascript", "mongodb", "docker", "aws", "typescript", "html", "css"],
    "Backend Developer": ["python", "java", "node.js", "sql", "postgresql", "mongodb", "api", "docker", "aws"],
    "Frontend Developer": ["react", "javascript", "typescript", "html", "css", "vue", "angular", "tailwind"],
    "Data Analyst": ["sql", "excel", "python", "tableau", "powerbi", "statistics"],
    "DevOps Engineer": ["aws", "docker", "kubernetes", "linux", "ci/cd", "terraform", "python"],
    "Cloud Engineer": ["aws", "azure", "gcp", "docker", "kubernetes", "linux", "terraform"],
    "Security Engineer": ["cybersecurity", "linux", "network security", "penetration testing", "cryptography", "python"],
    "Software Developer": ["java", "c++", "python", "data structures", "algorithms", "sql", "git"],
    "Software Engineer": ["python", "java", "sql", "git", "agile", "aws", "docker"]
}

def analyze_skill_gap(predicted_role, extracted_skills):
    """Calculates the ATS Score and identifies missing industry skills."""
    ideal_skills = ROLE_SKILLS_MAP.get(predicted_role, [])
    extracted_lower = [str(s).lower() for s in extracted_skills]
    
    # Find what the user is missing
    missing_skills = [skill.title() for skill in ideal_skills if skill not in extracted_lower]
    
    # Calculate ATS Match Score (Base 40% + Skill Match Percentage)
    if not ideal_skills:
        ats_score = 75 # Default score if role is unknown
    else:
        matched_count = len(ideal_skills) - len(missing_skills)
        match_ratio = matched_count / len(ideal_skills)
        ats_score = int(40 + (match_ratio * 60)) 
        
    return missing_skills, ats_score

# ======================================================
# ☁️ CLOUD LIVE JOB FETCHER (GUARANTEES 3 INDIAN JOBS)
# ======================================================
def fetch_live_jobs(role, location="Bengaluru, India"):
    try:
        print(f"☁️ Fetching live internet jobs for: {role} in India...")
        
        # Expanded API Search Terms
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

            # Predict Role
            predicted_role = predict_best_role(extracted_skills)

            # Calculate ATS Score & Missing Skills
            missing_skills, ats_score = analyze_skill_gap(predicted_role, extracted_skills)

            # Fetch Live Jobs
            recommended_jobs = fetch_live_jobs(predicted_role)

            # Save to Database
            candidate_data = {
                "filename": file.filename,
                "skills": extracted_skills,
                "predicted_role": predicted_role,
                "ats_score": ats_score, 
                "uploaded_at": datetime.utcnow().isoformat()
            }
            save_candidate(candidate_data)

            # Build Response Payload
            results.append({
                "filename": file.filename,
                "extracted_skills": extracted_skills,
                "predicted_role": predicted_role,
                "missing_skills": missing_skills,
                "ats_score": ats_score,          
                "recommended_jobs": recommended_jobs
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