"""
ResumeAIX — FastAPI backend: PDF → pdfminer → Gemini 2.5 Flash (google-genai) → Remotive jobs.
"""
from __future__ import annotations

import json
import os
import shutil
import sys
import uuid
from typing import Any
from urllib.parse import quote

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
    },
    "required": [
        "ats_score",
        "predicted_role",
        "matched_skills",
        "missing_skills",
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
    system = (
        "You are an expert ATS recruiter. Analyze the resume strictly from the text. "
        "Score how well it would pass typical ATS filters for the predicted role."
    )
    user = (
        f"{system}\n\n--- RESUME ---\n{truncated}\n--- END ---\n"
        "Output JSON only: ats_score 0-100, predicted_role (one concise title), "
        "matched_skills (strengths), missing_skills (gaps vs that role)."
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
    return {
        "ats_score": ats_score,
        "predicted_role": best_role,
        "matched_skills": best_match[:12],
        "missing_skills": missing[:12],
    }


def fetch_remotive_jobs(predicted_role: str, limit: int = 3) -> list[dict[str, Any]]:
    words = predicted_role.replace("/", " ").split()[:4]
    search = " ".join(words).strip() or "software developer"
    url = "https://remotive.com/api/remote-jobs"
    out: list[dict[str, Any]] = []
    try:
        r = requests.get(
            url,
            params={"search": search},
            timeout=20,
        )
        r.raise_for_status()
        payload = r.json()
        jobs = payload.get("jobs") or []
        for j in jobs:
            if len(out) >= limit:
                break
            u = j.get("url") or "#"
            out.append(
                {
                    "title": j.get("title") or "Open role",
                    "company": j.get("company_name") or "Company",
                    "location": j.get("candidate_required_location") or "Remote",
                    "type": "Remote",
                    "url": u,
                    "match_score": max(72, 94 - len(out) * 8),
                }
            )
    except Exception as exc:
        _log(f"[Remotive] {type(exc).__name__}: {exc!r}")

    i = len(out)
    while len(out) < limit:
        out.append(
            {
                "title": f"{predicted_role} - search live roles",
                "company": "Remotive",
                "location": "Remote",
                "type": "Remote",
                "url": f"https://remotive.com/remote-jobs/search?search={quote(search)}",
                "match_score": max(55, 78 - i * 6),
            }
        )
        i += 1
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


@app.post("/analyze")
async def analyze(file: UploadFile = File(..., description="PDF resume")):
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

        jobs = fetch_remotive_jobs(role, 3)

        return {
            "ats_score": ats,
            "predicted_role": role,
            "matched_skills": matched,
            "missing_skills": missing,
            "keywords": matched[:15],
            "jobs": jobs,
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
