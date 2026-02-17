import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import uuid
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import List
import shutil
import os

# Custom modules
from parser import parse_resume
from matcher import (
    calculate_similarity,
    skill_gap_analysis,
    generate_learning_roadmap,
    weighted_skill_match,
    predict_job_role
)
from database import save_candidate, collection
from report_generator import generate_pdf_report


app = FastAPI(title="AI Resume Scanner API", version="4.0 - Advanced Edition")

# ======================================================
# CORS
# ======================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
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


# ======================================================
# 🔥 ADVANCED PROFESSIONAL RECOMMENDATION ENGINE
# ======================================================

def generate_professional_feedback(parsed, score, missing_skills, predicted_role):
    skills = parsed.get("skills", [])
    education = parsed.get("education", [])
    experience = parsed.get("experience_years", 0)

    feedback = []

    # Experience analysis
    if experience < 1:
        feedback.append(
            "Gain internship or hands-on project experience to strengthen industry readiness."
        )
    elif experience >= 3:
        feedback.append(
            "Highlight leadership impact and measurable results in previous roles."
        )

    # Project maturity analysis
    if len(skills) < 5:
        feedback.append(
            "Expand technical stack and diversify project exposure."
        )

    # Role-specific intelligence
    if predicted_role == "Machine Learning Engineer":
        if "python" not in [s.lower() for s in skills]:
            feedback.append("Strengthen Python fundamentals for ML roles.")
        feedback.append(
            "Build 2 production-ready ML projects with deployment (API + Docker)."
        )

    if predicted_role == "Full Stack Developer":
        if "react" not in [s.lower() for s in skills]:
            feedback.append("Add modern frontend framework (React/Next.js).")
        feedback.append(
            "Demonstrate full CRUD app with authentication and deployment."
        )

    if predicted_role == "DevOps Engineer":
        feedback.append(
            "Gain hands-on CI/CD pipeline and container orchestration exposure."
        )

    # Missing skills targeting
    if missing_skills:
        feedback.append(
            f"Priority skill gap: {', '.join(missing_skills[:5])}"
        )

    # Strategic positioning
    if score < 50:
        feedback.append(
            "Your profile requires structured upskilling before applying to similar roles."
        )
    elif score >= 80:
        feedback.append(
            "You are competitive. Focus on polishing resume metrics and interview preparation."
        )

    return feedback
# ======================================================
# Email Interview Invitation System
# ======================================================

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = "yourcompanyemail@gmail.com"
SENDER_PASSWORD = "your_app_password"
  # Use Gmail App Password

COMPANY_NAME = "AI Systems Pvt Ltd"
COMPANY_ROLE = "Machine Learning Engineer"
INTERVIEW_DURATION = "30 Minutes"


def send_interview_email(candidate_email: str, candidate_name: str):
    try:
        # Unique Interview Token
        interview_token = str(uuid.uuid4())
        interview_link = f"http://localhost:3000/interview/{interview_token}"

        message = MIMEMultipart("alternative")
        message["Subject"] = f"Interview Invitation – {COMPANY_NAME}"
        message["From"] = SENDER_EMAIL
        message["To"] = candidate_email

        html_content = f"""
        <html>
        <body>
            <h2>Interview Invitation</h2>

            <p>Dear {candidate_name},</p>

            <p>Congratulations! Based on your resume evaluation, 
            you have been shortlisted for the role of <b>{COMPANY_ROLE}</b>.</p>

            <h3>Interview Details:</h3>
            <ul>
                <li><b>Company:</b> {COMPANY_NAME}</li>
                <li><b>Role:</b> {COMPANY_ROLE}</li>
                <li><b>Mode:</b> Online AI Interview</li>
                <li><b>Duration:</b> {INTERVIEW_DURATION}</li>
            </ul>

            <p>Please click the link below to begin your AI interview:</p>

            <a href="{interview_link}" 
               style="background:#2563eb;color:white;padding:10px 20px;
               text-decoration:none;border-radius:5px;">
               Start Interview
            </a>

            <br><br>
            <p>Best Regards,<br>
            HR Team<br>
            {COMPANY_NAME}</p>
        </body>
        </html>
        """

        message.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, candidate_email, message.as_string())

        return interview_token

    except Exception as e:
        print("Email Error:", str(e))
        return None


# ======================================================
# Routes
# ======================================================

@app.get("/")
def home():
    return {"message": "AI Resume Scanner Backend Running"}


@app.get("/health")
def health_check():
    return {"status": "OK"}


# ------------------------------------------------------
# Upload Route (Advanced)
# ------------------------------------------------------

@app.post("/upload_resume/")
async def upload_resume(
    files: List[UploadFile] = File(...),
    job_description: str = ""
):
    try:
        results = []

        # Clear old session data
        collection.delete_many({})

        for file in files:

            validate_file(file.filename)

            file_path = os.path.join(UPLOAD_FOLDER, file.filename)

            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            parsed = parse_resume(file_path)

            # Remove file immediately
            os.remove(file_path)

            resume_text = parsed.get("cleaned_text")
            if not resume_text or isinstance(resume_text, list):
                resume_text = " ".join(parsed.get("skills", []))

            predicted_role = predict_job_role(resume_text)

            similarity_score = 0
            weighted_score = 0
            gap_data = {"matched_skills": [], "missing_skills": []}

            if job_description.strip():
                similarity_score = calculate_similarity(
                    resume_text,
                    job_description
                )

                weighted_score, _ = weighted_skill_match(
                    parsed.get("skills", []),
                    job_description
                )

                gap_data = skill_gap_analysis(
                    resume_text,
                    job_description
                )

            # Hybrid AI score
            match_score = round(
                (similarity_score * 0.5) + (weighted_score * 0.5),
                2
            )

            status = classify_status(match_score)
            # Send email if selected
            if status in ["Highly Recommended", "Recommended"]:
                candidate_email = parsed.get("email", "testcandidate@gmail.com")
                candidate_name = parsed.get("name", "Candidate")

                send_interview_email(candidate_email, candidate_name)


            missing_skills = gap_data.get("missing_skills", [])

            # Advanced professional feedback
            recommendations = generate_professional_feedback(
                parsed,
                match_score,
                missing_skills,
                predicted_role
            )

            roadmap = []
            if status in ["Not Suitable", "Low Match"]:
                roadmap = generate_learning_roadmap(missing_skills)

            candidate_data = {
                "filename": file.filename,
                "skills": parsed.get("skills", []),
                "match_percentage": match_score,
                "status": status,
                "predicted_role": predicted_role,
                "uploaded_at": datetime.utcnow().isoformat()
            }

            save_candidate(candidate_data)

            results.append({
                "filename": file.filename,
                "match_percentage": match_score,
                "status": status,
                "predicted_role": predicted_role,
                "matched_skills": gap_data.get("matched_skills", []),
                "missing_skills": missing_skills,
                "recommendations": recommendations,
                "roadmap": roadmap,
                "weighted_score": weighted_score
            })

        return {"batch_results": results}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ------------------------------------------------------
# Ranking
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
# Analytics
# ------------------------------------------------------

@app.get("/analytics")
def analytics():
    candidates = list(collection.find({}, {"_id": 0}))

    if not candidates:
        return {"total_resumes": 0}

    total = len(candidates)
    average = round(
        sum(c["match_percentage"] for c in candidates) / total,
        2
    )

    status_distribution = {}
    for c in candidates:
        s = c["status"]
        status_distribution[s] = status_distribution.get(s, 0) + 1

    return {
        "total_resumes": total,
        "average_match": average,
        "status_distribution": status_distribution
    }


# ------------------------------------------------------
# PDF Generator (Offer Letter Style)
# ------------------------------------------------------

@app.post("/generate_report/")
async def generate_report(data: dict):
    try:
        filename = data.get("filename")

        if not filename:
            raise HTTPException(status_code=400, detail="Filename required")

        # Create safe file name
        safe_name = filename.replace(" ", "_").replace("/", "")

        output_file = os.path.join(
            UPLOAD_FOLDER,
            f"{safe_name}_report.pdf"
        )

        # Generate PDF
        generate_pdf_report(data, output_file)

        # Check file exists
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


# ------------------------------------------------------
# Local Dev
# ------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
