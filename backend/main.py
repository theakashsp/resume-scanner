from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import List
import shutil
import os
from matcher import weighted_skill_match
from matcher import predict_job_role



from parser import parse_resume
from matcher import (
    calculate_similarity,
    skill_gap_analysis,
    generate_learning_roadmap
)
from database import save_candidate, collection
from report_generator import generate_pdf_report


app = FastAPI(title="AI Resume Scanner API", version="3.0")

# ======================================================
# CORS (Restrict in production)
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


# ======================================================
# Utility Functions
# ======================================================

def validate_file(filename: str):
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are supported."
        )


def classify_status(score: float) -> str:
    if score >= 85:
        return "Highly Recommended"
    elif score >= 70:
        return "Recommended"
    elif score >= 50:
        return "Consider"
    elif score >= 35:
        return "Low Match"
    else:
        return "Not Suitable"


def generate_recommendations(score: float, missing_skills: list, job_description: str):
    recommendations = []

    if score >= 70:
        recommendations.append(
            "You are a strong candidate. Improve project depth and portfolio."
        )
        return recommendations

    if missing_skills:
        recommendations.append(
            f"Focus on learning these skills: {', '.join(missing_skills)}"
        )

    if score < 50:
        recommendations.append(
            "Build at least 2 real-world projects related to this job role."
        )

    if score < 35:
        recommendations.append(
            "Strengthen fundamentals and follow structured learning roadmap."
        )

    jd = job_description.lower()

    if "machine learning" in jd:
        recommendations.append(
            "Suggested Path: Python → NumPy/Pandas → Scikit-learn → Deep Learning → Model Deployment."
        )

    if "full stack" in jd:
        recommendations.append(
            "Suggested Path: HTML/CSS → JavaScript → React → Node.js → MongoDB → Deployment."
        )

    if "devops" in jd:
        recommendations.append(
            "Suggested Path: Linux → Git → Docker → CI/CD → AWS → Kubernetes."
        )

    return recommendations


# ======================================================
# Routes
# ======================================================

@app.get("/")
def home():
    return {"message": "Resume Scanner Backend Running Successfully"}


@app.get("/health")
def health_check():
    return {"status": "OK"}


# ------------------------------------------------------
# Batch Upload Route
# ------------------------------------------------------
@app.post("/upload_resume/")
async def upload_resume(
    files: List[UploadFile] = File(...),
    job_description: str = ""
):
    try:
        results = []

        for file in files:

            validate_file(file.filename)

            file_path = os.path.join(UPLOAD_FOLDER, file.filename)

            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            parsed = parse_resume(file_path)

            resume_text = parsed.get("cleaned_text")
            predicted_role = predict_job_role(resume_text)

            if not resume_text or isinstance(resume_text, list):
                resume_text = " ".join(parsed.get("skills", []))

            match_score = 0
            gap_data = {"matched_skills": [], "missing_skills": []}

            if job_description.strip():
                # Original similarity
                    similarity_score = calculate_similarity(resume_text, job_description)

                    # Weighted skill score
                    weighted_score, weighted_matched = weighted_skill_match(
                        parsed.get("skills", []),
                        job_description
                    )

                    # Final blended score (Hybrid AI)
                    match_score = round((similarity_score * 0.5) + (weighted_score * 0.5), 2)

                    gap_data = skill_gap_analysis(resume_text, job_description)

            match_score = round(match_score, 2)
            status = classify_status(match_score)

            missing_skills = gap_data.get("missing_skills", [])

            recommendations = generate_recommendations(
                match_score,
                missing_skills,
                job_description
            )

            roadmap = []
            if status in ["Not Suitable", "Low Match"]:
                roadmap = generate_learning_roadmap(missing_skills)

            candidate_data = {
                "filename": file.filename,
                "skills": parsed.get("skills", []),
                "match_percentage": match_score,
                "status": status,
                "uploaded_at": datetime.utcnow().isoformat()
            }

            save_candidate(candidate_data)

            results.append({
                "filename": file.filename,
                "match_percentage": match_score,
                "status": status,
                "matched_skills": gap_data.get("matched_skills", []),
                "missing_skills": missing_skills,
                "recommendations": recommendations,
                "roadmap": roadmap,  # Added missing comma here
                "weighted_score": weighted_score,
                "predicted_role": predicted_role,

            })

        return {"batch_results": results}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ------------------------------------------------------
# Ranking Route
# ------------------------------------------------------
@app.get("/rank_candidates")
def rank_candidates():
    candidates = list(collection.find({}, {"_id": 0}))
    return sorted(
        candidates,
        key=lambda x: x.get("match_percentage", 0),
        reverse=True
    )


# ------------------------------------------------------
# Analytics Route
# ------------------------------------------------------
@app.get("/analytics")
def analytics():
    candidates = list(collection.find({}, {"_id": 0}))

    if not candidates:
        return {
            "total_resumes": 0,
            "average_match": 0,
            "highest_match": 0,
            "top_skills": [],
            "status_distribution": {}
        }

    total = len(candidates)

    average = round(
        sum(c.get("match_percentage", 0) for c in candidates) / total,
        2
    )

    highest = max(
        c.get("match_percentage", 0) for c in candidates
    )

    skill_count = {}
    status_count = {}

    for c in candidates:
        for skill in c.get("skills", []):
            skill_count[skill] = skill_count.get(skill, 0) + 1

        status = c.get("status", "Unknown")
        status_count[status] = status_count.get(status, 0) + 1

    top_skills = sorted(
        skill_count.items(),
        key=lambda x: x[1],
        reverse=True
    )[:5]

    return {
        "total_resumes": total,
        "average_match": average,
        "highest_match": highest,
        "top_skills": top_skills,
        "status_distribution": status_count
    }


# ------------------------------------------------------
# PDF Report Generator
# ------------------------------------------------------
@app.post("/generate_report/")
async def generate_report(data: dict):
    try:
        filename = data.get("filename")

        if not filename:
            raise HTTPException(status_code=400, detail="Filename required")

        output_file = os.path.join(
            UPLOAD_FOLDER,
            f"{filename}_report.pdf"
        )

        generate_pdf_report(data, output_file)

        return FileResponse(
            output_file,
            media_type="application/pdf",
            filename=f"{filename}_Report.pdf"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ------------------------------------------------------
# Local Development
# ------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
