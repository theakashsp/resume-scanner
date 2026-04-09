import React, { useState, useRef } from "react";
import axios from "axios";
import "./App.css";

const STEPS = [
  "Uploading resume...",
  "Parsing document...",
  "Running ATS analysis...",
  "Mapping skill gaps...",
  "Generating career paths...",
  "Fetching job matches...",
  "Finalising results...",
];

function CircularScore({ score }) {
  const radius = 54;
  const stroke = 6;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const progress = isNaN(score) ? 0 : Math.min(Math.max(score, 0), 100);
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="circular-score">
      <svg height={radius * 2} width={radius * 2}>
        <circle
          className="score-track"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          fill="transparent"
        />
        <circle
          className="score-fill"
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          fill="transparent"
          transform={`rotate(-90 ${radius} ${radius})`}
        />
      </svg>
      <div className="score-label-inner">
        <span className="score-number">{progress}</span>
        <span className="score-unit">/ 100</span>
      </div>
    </div>
  );
}

function StepProgress({ statusMsg }) {
  const activeIdx = STEPS.findIndex((s) => s === statusMsg);
  const idx = activeIdx === -1 ? 0 : activeIdx;

  return (
    <div className="step-progress">
      <div className="step-spinner" />
      <p className="step-current">{statusMsg || STEPS[0]}</p>
      <div className="step-track">
        {STEPS.map((step, i) => (
          <div
            key={i}
            className={`step-pip ${i < idx ? "done" : i === idx ? "active" : ""}`}
          />
        ))}
      </div>
      <p className="step-fraction">
        Step {idx + 1} of {STEPS.length}
      </p>
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [batchResults, setBatchResults] = useState([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const API_BASE = "http://localhost:8000";

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) setFile(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    setBatchResults([]);

    const formData = new FormData();
    formData.append("files", file); 

    try {
      const steps = [
        STEPS[1], STEPS[2], STEPS[3], STEPS[4], STEPS[5], STEPS[6],
      ];
      let si = 0;
      setStatusMsg(STEPS[0]);
      
      const interval = setInterval(() => {
        si++;
        if (si < steps.length) setStatusMsg(steps[si]);
        else clearInterval(interval);
      }, 700);

      const res = await axios.post(
        `${API_BASE}/upload_resume/`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" }
        }
      );

      clearInterval(interval);
      
      // Navigate down to the career_paths array returned by FastAPI
      if (res.data && res.data.batch_results && res.data.batch_results.length > 0) {
          setBatchResults(res.data.batch_results[0].career_paths || []);
      } else {
          setBatchResults([]);
      }
      
      setLoading(false);
      setStatusMsg("");
      
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Something went wrong. Please check backend connection."
      );
      setLoading(false);
      setStatusMsg("");
    }
  };

  const handleDownloadPDF = async (path) => {
    try {
      const res = await axios.post(
        `${API_BASE}/generate_report/`,
        { 
            filename: file.name,
            predicted_role: path.predicted_role,
            missing_skills: path.missing_skills,
            ats_score: path.ats_score
        },
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${file.name.split('.')[0]}_${path.predicted_role.replace(/\s+/g, '_')}_Report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert("Failed to download PDF.");
    }
  };

  return (
    <div className="app-root">
      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="nav-brand">
          <span className="nav-logo-dot" />
          <span className="nav-logo-text">ResumeAI</span>
        </div>
        <div className="nav-links">
          <a href="#home" className="nav-link">Home</a>
          <a href="#dashboard" className="nav-link">Dashboard</a>
        </div>
        <button className="nav-logout" onClick={() => window.location.reload()}>Logout</button>
      </nav>

      <main className="main-content">
        {/* ── Hero ── */}
        <section className="hero" id="home">
          <div className="hero-badge">AI-powered · Free to use</div>
          <h1 className="hero-title">
            Land your dream role,<br />faster than ever.
          </h1>
          <p className="hero-sub">
            Upload your resume and instantly get an ATS compatibility score,
            verified skill tags, gap analysis, and tailored job recommendations.
          </p>
        </section>

        {/* ── Upload Form ── */}
        <section className="upload-section" id="dashboard">
          <form onSubmit={handleSubmit} className="upload-form">
            <div
              className={`drop-zone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <div className="drop-icon">
                {file ? "✔" : "↑"}
              </div>
              {file ? (
                <div>
                  <p className="drop-filename">{file.name}</p>
                  <p className="drop-hint">Click to change file</p>
                </div>
              ) : (
                <div>
                  <p className="drop-title">Drop your resume here</p>
                  <p className="drop-hint">PDF or DOCX · up to 10 MB</p>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="submit-btn"
              disabled={!file || loading}
            >
              {loading ? "Analysing…" : "Analyse Resume →"}
            </button>
          </form>
        </section>

        {/* ── Loading State ── */}
        {loading && <StepProgress statusMsg={statusMsg} />}

        {/* ── Error ── */}
        {error && <div className="error-banner">{error}</div>}

        {/* ── Results ── */}
        {!loading && batchResults.length > 0 && (
          <section className="results-section">
            {batchResults.map((path, pi) => (
              <div key={pi} className="career-card">
                {/* Header */}
                <div className="career-header">
                  <div>
                    <p className="career-label">Career path {pi + 1}</p>
                    <h2 className="career-title">{path.predicted_role}</h2>
                  </div>
                  <button
                    className="pdf-btn"
                    onClick={() => handleDownloadPDF(path)}
                  >
                    ↓ Download PDF
                  </button>
                </div>

                {/* ATS Score */}
                <div className="ats-row">
                  <div className="ats-score-wrap">
                    <h3 className="section-heading">ATS score</h3>
                    <CircularScore score={path.ats_score} />
                  </div>

                  <div className="ats-skills">
                    {/* Verified Skills */}
                    <div className="skill-block">
                      <h3 className="section-heading">Verified skills</h3>
                      <div className="tag-list">
                        {(path.matched_skills || []).map((sk, i) => (
                          <span key={i} className="tag tag-skill">{sk}</span>
                        ))}
                        {(!path.matched_skills || path.matched_skills.length === 0) && (
                            <span style={{fontSize: '14px', color: '#64748b'}}>No core skills matched.</span>
                        )}
                      </div>
                    </div>

                    {/* Skill Gaps */}
                    <div className="skill-block">
                      <h3 className="section-heading">Skill gaps</h3>
                      <div className="tag-list">
                        {(path.missing_skills || []).map((sk, i) => (
                          <span key={i} className="tag tag-gap">{sk}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recommended Jobs */}
                {path.recommended_jobs && path.recommended_jobs.length > 0 && (
                  <div className="jobs-section">
                    <h3 className="section-heading">Recommended jobs</h3>
                    <div className="jobs-grid">
                      {path.recommended_jobs.map((job, ji) => (
                        <div key={ji} className="job-card">
                          <div className="job-card-top">
                            <div className="job-avatar">
                              {(job.company || "J")[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="job-title">{job.title}</p>
                              <p className="job-company">{job.company}</p>
                            </div>
                          </div>
                          {job.location && (
                            <p className="job-location">📍 {job.location}</p>
                          )}
                          
                          {/* 💡 THE FIX: Properly formatted HTML Anchor tag */}
                          <a 
                            href={job.link || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="apply-btn"
                          >
                            Apply now →
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}
      </main>

      <footer className="footer">
        <p>ResumeAI · Built with Gemini &amp; FastAPI</p>
      </footer>
    </div>
  );
}