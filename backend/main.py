"""
ResumeAIX — FastAPI backend: PDF → pdfminer → Gemini 2.5 Flash (google-genai) → Remotive jobs.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import sys
import uuid
from typing import Any

# Windows consoles often default to cp1252; printing Unicode (or logging) can raise UnicodeEncodeError.
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except (OSError, ValueError, AttributeError):
        pass


def _log(msg: object) -> None:
    """Log without failing on Windows charmap (cp1252) consoles."""
    try:
        line = f"{msg}\n".encode("utf-8", errors="replace")
        sys.stderr.buffer.write(line)
        sys.stderr.buffer.flush()
    except Exception:
        pass

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pdfminer.high_level import extract_text as pdfminer_extract_text

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY", "").strip()
RAPIDAPI_HOST = os.getenv("RAPIDAPI_HOST", "jsearch.p.rapidapi.com").strip()
_genai_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
]

app = FastAPI(title="ResumeAIX API", version="2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ATS_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "ats_score": {"type": "integer", "minimum": 0, "maximum": 100},
        "predicted_role": {"type": "string"},
        "matched_skills": {"type": "array", "items": {"type": "string"}},
        "missing_skills": {"type": "array", "items": {"type": "string"}},
        "learning_roadmap": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "step": {"type": "integer"},
                    "title": {"type": "string"},
                    "focus": {"type": "string"},
                    "project_idea": {"type": "string"},
                },
                "required": ["step", "title", "focus", "project_idea"],
            },
        },
        "custom_suggestion": {"type": "string"},
    },
    "required": [
        "ats_score",
        "predicted_role",
        "matched_skills",
        "missing_skills",
        "learning_roadmap",
        "custom_suggestion",
    ],
}


def _normalize_resume_text(text: str) -> str:
    """Ensure text is safe UTF-8 for LLM + JSON (replace odd surrogates / mojibake)."""
    if not text:
        return ""
    # pdfminer returns str; normalize via UTF-8 round-trip with replacement
    return text.encode("utf-8", errors="replace").decode("utf-8", errors="replace").strip()


def extract_pdf_text(path: str) -> str:
    try:
        raw = pdfminer_extract_text(path) or ""
        return _normalize_resume_text(raw)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"PDF read error: {type(e).__name__}",
        )


def analyze_resume_with_gemini(resume_text: str) -> dict[str, Any]:
    if _genai_client is None:
        raise RuntimeError("GEMINI_API_KEY missing")
    truncated = _normalize_resume_text(resume_text)[:28000]
    system = """
You are an expert Career Counselor for Indian job seekers.
Analyze the resume text deeply and return ONLY valid JSON.
No markdown, no explanations outside JSON.
The output must be concrete and personalized (not generic).
"""
    user = (
        f"{system}\n"
        "\nRules:\n"
        "1) predicted_role must be one realistic role title.\n"
        "2) ats_score must be integer 0-100.\n"
        "3) matched_skills and missing_skills must be practical and role-specific.\n"
        "4) learning_roadmap must be sequential and actionable, each step with title, focus, and project_idea.\n"
        "5) custom_suggestion must be one personalized paragraph, encouraging and specific.\n"
        "6) Avoid boilerplate.\n"
        f"\n--- RESUME ---\n{truncated}\n--- END ---\n"
    )
    try:
        response = _genai_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=user,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_json_schema=ATS_JSON_SCHEMA,
                temperature=0.15,
            ),
        )
        raw = response.text
        data = json.loads(raw)
        return data
    except Exception as e:
        _log(f"[Gemini] {type(e).__name__}: {e!r}")
        safe_detail = str(e).encode("ascii", "backslashreplace").decode("ascii")
        raise HTTPException(
            status_code=502,
            detail=f"Gemini analysis failed: {safe_detail[:500]}",
        )


def analyze_resume_fallback(resume_text: str) -> dict[str, Any]:
    """Local heuristic ATS analysis used when Gemini key is unavailable."""
    text = _normalize_resume_text(resume_text).lower()
    role_keywords: dict[str, list[str]] = {
        "Data Scientist": [
            "python",
            "pandas",
            "numpy",
            "scikit",
            "machine learning",
            "tensorflow",
            "pytorch",
            "sql",
            "statistics",
            "power bi",
        ],
        "Backend Developer": [
            "python",
            "fastapi",
            "django",
            "flask",
            "api",
            "sql",
            "postgresql",
            "redis",
            "docker",
            "aws",
        ],
        "Frontend Developer": [
            "javascript",
            "typescript",
            "react",
            "next.js",
            "html",
            "css",
            "redux",
            "tailwind",
            "webpack",
            "api",
        ],
        "DevOps Engineer": [
            "docker",
            "kubernetes",
            "jenkins",
            "github actions",
            "terraform",
            "aws",
            "azure",
            "gcp",
            "linux",
            "monitoring",
        ],
    }

    best_role = "Software Engineer"
    best_match: list[str] = []
    best_total = 10
    for role, keywords in role_keywords.items():
        matched = [k for k in keywords if k in text]
        if len(matched) > len(best_match):
            best_role = role
            best_match = matched
            best_total = len(keywords)

    missing = [k for k in role_keywords.get(best_role, []) if k not in best_match]
    ratio = (len(best_match) / max(1, best_total)) * 100
    ats_score = int(max(35, min(95, round(40 + ratio * 0.55))))
    roadmap = [
        {
            "step": 1,
            "title": "Strengthen missing fundamentals",
            "focus": f"Study and practice: {', '.join(missing[:3]) or 'core role concepts'}.",
            "project_idea": f"Build a mini {best_role.lower()} project using at least two missing skills.",
        },
        {
            "step": 2,
            "title": "Build portfolio depth",
            "focus": "Create production-style project structure, tests, and documentation.",
            "project_idea": "Publish one end-to-end project with README, screenshots, and architecture notes.",
        },
        {
            "step": 3,
            "title": "Interview and ATS optimization",
            "focus": "Rewrite resume bullets with metrics and role keywords.",
            "project_idea": "Prepare a 2-minute project walkthrough and common interview Q&A set.",
        },
    ]
    suggestion = (
        f"You already show a base for {best_role} with strengths in {', '.join(best_match[:4]) or 'relevant tools'}. "
        f"To improve hiring chances, focus next on {', '.join(missing[:3]) or 'deeper role-specific skills'}, "
        "and convert that learning into one strong portfolio project with measurable outcomes. "
        "You are close to interview-ready if you consistently practice and align your resume keywords with target job descriptions."
    )
    return {
        "ats_score": ats_score,
        "predicted_role": best_role,
        "matched_skills": best_match[:12],
        "missing_skills": missing[:12],
        "learning_roadmap": roadmap,
        "custom_suggestion": suggestion,
    }


def _extract_candidate_details(resume_text: str) -> dict[str, str]:
    lines = [ln.strip() for ln in resume_text.splitlines() if ln.strip()]
    email_match = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", resume_text)
    email = email_match.group(0) if email_match else "Not found"
    probable_name = "Not found"
    for ln in lines[:8]:
        if "@" in ln or len(ln.split()) < 2 or len(ln.split()) > 5:
            continue
        if re.search(r"\d", ln):
            continue
        probable_name = ln
        break
    return {"candidate_name": probable_name, "candidate_email": email}


def fetch_jsearch_jobs(predicted_role: str, limit: int = 5) -> list[dict[str, Any]]:
    query = f"{predicted_role} in India"
    out: list[dict[str, Any]] = []
    if not RAPIDAPI_KEY:
        return out

    try:
        r = requests.get(
            "https://jsearch.p.rapidapi.com/search",
            headers={
                "X-RapidAPI-Key": RAPIDAPI_KEY,
                "X-RapidAPI-Host": RAPIDAPI_HOST,
            },
            params={
                "query": query,
                "page": "1",
                "num_pages": "1",
                "country": "in",
            },
            timeout=20,
        )
        r.raise_for_status()
        payload = r.json()
        jobs = payload.get("data") or []
        for j in jobs:
            if len(out) >= limit:
                break
            apply_link = j.get("job_apply_link") or j.get("job_google_link") or "#"
            out.append(
                {
                    "employer_name": j.get("employer_name") or "Hiring Company",
                    "job_title": j.get("job_title") or predicted_role,
                    "job_apply_link": apply_link,
                    "location": ", ".join(
                        [x for x in [j.get("job_city"), j.get("job_country")] if x]
                    )
                    or "India",
                    "job_employment_type": j.get("job_employment_type") or "Full-time",
                }
            )
    except Exception as exc:
        _log(f"[JSearch] {type(exc).__name__}: {exc!r}")
    return out[:limit]


@app.get("/")
def root():
    return {"service": "ResumeAIX", "health": "/health", "analyze": "POST /analyze"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/analyze")
def analyze_get_info():
    return {
        "detail": "Use POST with multipart form field 'file' (PDF).",
        "field": "file",
    }


@app.get("/api/analyze")
def analyze_get_info_compat():
    return analyze_get_info()


async def _analyze_impl(file: UploadFile) -> dict[str, Any]:
    fname = (file.filename or "").lower()
    if not fname.endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF uploads are supported for /analyze.",
        )
    internal = f"{uuid.uuid4().hex}.pdf"
    path = os.path.join(UPLOAD_DIR, internal)
    try:
        with open(path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        text = extract_pdf_text(path)
        if not text:
            raise HTTPException(
                status_code=400,
                detail="No extractable text in PDF (try a text-based PDF).",
            )

        try:
            ai = analyze_resume_with_gemini(text)
        except Exception:
            ai = analyze_resume_fallback(text)
        role = str(ai.get("predicted_role") or "Software Engineer").strip()
        try:
            ats = int(ai.get("ats_score", 0))
        except (TypeError, ValueError):
            ats = 50
        ats = max(0, min(100, ats))

        matched = [str(s).strip() for s in (ai.get("matched_skills") or []) if s]
        missing = [str(s).strip() for s in (ai.get("missing_skills") or []) if s]

        jobs = fetch_jsearch_jobs(role, 5)
        details = _extract_candidate_details(text)

        return {
            "ats_score": ats,
            "predicted_role": role,
            "matched_skills": matched,
            "missing_skills": missing,
            "learning_roadmap": ai.get("learning_roadmap") or [],
            "custom_suggestion": str(ai.get("custom_suggestion") or "").strip(),
            "keywords": matched[:15],
            "jobs": jobs,
            "candidate_name": details.get("candidate_name", "Not found"),
            "candidate_email": details.get("candidate_email", "Not found"),
        }
    except HTTPException:
        raise
    except UnicodeEncodeError as e:
        _log(f"[analyze] UnicodeEncodeError: {e!r}")
        raise HTTPException(
            status_code=500,
            detail="Encoding error while processing the resume. Try saving the PDF as UTF-8 text or a simpler export.",
        )
    except Exception as e:
        _log(f"[analyze] {type(e).__name__}: {e!r}")
        safe_detail = str(e).encode("ascii", "backslashreplace").decode("ascii")
        raise HTTPException(
            status_code=500,
            detail=safe_detail[:800] if safe_detail else f"Analysis failed: {type(e).__name__}",
        )
    finally:
        if os.path.isfile(path):
            try:
                os.remove(path)
            except OSError:
                pass


@app.post("/analyze")
async def analyze(file: UploadFile = File(..., description="PDF resume")):
    return await _analyze_impl(file)


@app.post("/api/analyze")
async def analyze_compat(file: UploadFile = File(..., description="PDF resume")):
    return await _analyze_impl(file)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
