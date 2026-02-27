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

def predict_best_role(extracted_skills):
    if not extracted_skills:
        return "Software Engineer"
        
    skills = set([str(skill).lower() for skill in extracted_skills])
    
    ml_skills = {'python', 'machine learning', 'tensorflow', 'pytorch', 'data science', 'pandas', 'opencv', 'yolo'}
    web_skills = {'react', 'javascript', 'node.js', 'html', 'css', 'fastapi', 'django'}
    data_skills = {'sql', 'excel', 'tableau', 'powerbi', 'data analysis'}
    cloud_skills = {'aws', 'docker', 'kubernetes', 'azure', 'linux'}
    core_dev_skills = {'c', 'java', 'c++', 'data structures', 'algorithms'}

    if len(skills.intersection(ml_skills)) >= 2:
        return "Machine Learning Engineer"
    elif len(skills.intersection(web_skills)) >= 2:
        return "Full Stack Developer"
    elif len(skills.intersection(data_skills)) >= 2:
        return "Data Analyst"
    elif len(skills.intersection(cloud_skills)) >= 2:
        return "DevOps Engineer"
    elif len(skills.intersection(core_dev_skills)) >= 2:
        return "Software Developer"
    else:
        return "Software Engineer" 

def fetch_live_jobs(role, location="Bengaluru, India"):
    try:
        search_term = "software"
        if "Data" in role: 
            search_term = "data"
        elif "Machine Learning" in role: 
            search_term = "machine learning"
        elif "DevOps" in role: 
            search_term = "devops"
        elif "Developer" in role: 
            search_term = "developer"

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
        
    except Exception:
        encoded_role = role.replace(" ", "%20")
        naukri_role = role.replace(" ", "-").lower()
        return [
            {"title": f"{role}", "company": "LinkedIn", "location": "🇮🇳 India", "link": f"https://www.linkedin.com/jobs/search/?keywords={encoded_role}&location=India&geoId=102713980"},
            {"title": f"{role}", "company": "Naukri", "location": "🇮🇳 India", "link": f"https://www.naukri.com/{naukri_role}-jobs-in-india"},
            {"title": f"{role}", "company": "Indeed", "location": "🇮🇳 India", "link": f"https://in.indeed.com/jobs?q={encoded_role}&l=India"}
        ]

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

            predicted_role = predict_best_role(extracted_skills)
            recommended_jobs = fetch_live_jobs(predicted_role)

            candidate_data = {
                "filename": file.filename,
                "skills": extracted_skills,
                "predicted_role": predicted_role,
                "uploaded_at": datetime.utcnow().isoformat()
            }
            save_candidate(candidate_data)

            results.append({
                "filename": file.filename,
                "extracted_skills": extracted_skills,
                "predicted_role": predicted_role,
                "recommended_jobs": recommended_jobs
            })

        return {"batch_results": results}

    except Exception as e:
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
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)