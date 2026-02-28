import React, { useState } from "react";
import axios from "axios";
import "./App.css"; 
import Login from "./Login";

const API_BASE = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null); 
  const [batchResults, setBatchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState(""); 

  const handleLogin = (status) => setIsLoggedIn(status);
  
  const handleLogout = () => {
    setIsLoggedIn(false);
    setSelectedFile(null);
    setBatchResults([]);
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) { 
      alert("Please select a resume file first."); 
      return; 
    }
    
    const formData = new FormData();
    formData.append("files", selectedFile);

    try {
      setLoading(true); 
      setError(""); 
      setStatusMsg("INITIALIZING AI SCAN..."); 
      setBatchResults([]);
      
      setTimeout(() => setStatusMsg("EXTRACTING DEEP SKILLS..."), 1000);
      setTimeout(() => setStatusMsg("CALCULATING ATS SCORE..."), 2000);
      setTimeout(() => setStatusMsg("MATCHING LIVE JOBS IN INDIA..."), 3000);

      const response = await axios.post(`${API_BASE}/upload_resume/`, formData, { 
        headers: { "Content-Type": "multipart/form-data" } 
      });
      
      setBatchResults(response.data.batch_results || []);
    } catch (err) { 
      console.error(err); 
      setError("Analysis failed. Please check backend connection."); 
    } finally { 
      setLoading(false); 
      setStatusMsg("");
    }
  };

  const handleDownloadPDF = async (res) => {
    try {
      const response = await axios.post(`${API_BASE}/generate_report/`, {
        filename: res.filename,
        predicted_role: res.predicted_role,
        extracted_skills: res.extracted_skills,
        missing_skills: res.missing_skills,
        ats_score: res.ats_score
      }, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${res.filename.split('.')[0]}_ATS_Report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      alert("Failed to generate PDF report.");
    }
  };

  if (!isLoggedIn) return <Login onLogin={handleLogin} />;

  return (
    <div className="App">
      <div className="header-row">
        <div className="brand-container left">
          <svg className="brand-icon" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="6"></circle>
            <circle cx="12" cy="12" r="2"></circle>
          </svg>
          <h1 className="brand-title">CareerMatch AI</h1>
        </div>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </div>

      <div className="card">
        <h2>📁 Upload Your Resume</h2>
        <p style={{ color: '#64748b', marginBottom: '30px', fontWeight: '600', fontSize: '14px' }}>
          Let our AI analyze your skills, calculate your ATS score, and find the best live jobs.
        </p>

        <div className="upload-container">
          <div className="upload-dropzone">
            <div className="upload-icon">📂</div>
            <p style={{ fontWeight: '800', color: '#1e293b', fontSize: '15px' }}>
              {selectedFile ? "FILE READY" : "CLICK TO BROWSE OR DRAG & DROP"}
            </p>
            {selectedFile && (
              <p className="file-info-text">✅ {selectedFile.name}</p>
            )}
            <input type="file" onChange={handleFileChange} accept=".pdf,.docx" />
          </div>

          <div className="action-box">
            <button 
              className="primary-btn" 
              onClick={handleUpload}
              disabled={!selectedFile || loading}
            >
              {loading ? "⚙️ ANALYZING..." : "🚀 Analyze & Find Jobs"}
            </button>
          </div>
        </div>
        {error && <p style={{ color: '#ef4444', marginTop: '15px', fontWeight: '800' }}>{error}</p>}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div className="spinner"></div>
          <p style={{ color: '#ffffff', fontWeight: '800', marginTop: '20px', letterSpacing: '0.15em' }}>
            {statusMsg}
          </p>
        </div>
      )}

      {batchResults.length > 0 && !loading && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h2>🎯 Your Career Dashboard</h2>
            <span style={{ background: '#22c55e', color: 'white', padding: '5px 15px', borderRadius: '50px', fontSize: '11px', fontWeight: '900' }}>LIVE SESSION ACTIVE</span>
          </div>
          
          {batchResults.map((res, index) => (
            <div key={index}>
              
              <div style={{ background: '#eff6ff', padding: '35px', borderRadius: '24px', border: '1px solid #bfdbfe', marginBottom: '45px', position: 'relative' }}>
                
                <button 
                  onClick={() => handleDownloadPDF(res)}
                  className="secondary-btn"
                  style={{ position: 'absolute', top: '35px', right: '35px' }}
                >
                  📥 Download PDF
                </button>

                <h3 style={{ color: '#1e40af', marginBottom: '25px', fontSize: '28px', fontWeight: '800' }}>
                  Predicted Role: {res.predicted_role}
                </h3>
                
                <div className="ats-container">
                  <div className="ats-header">
                    <span className="ats-title">ATS Match Score</span>
                    <span className="ats-score-text">{res.ats_score ? res.ats_score : '75'}%</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${res.ats_score ? res.ats_score : 75}%` }}></div>
                  </div>
                </div>

                <p style={{fontSize:'12px', fontWeight:'800', color: '#64748b', marginTop:'25px', textTransform: 'uppercase', letterSpacing: '0.08em'}}>
                  ✅ Verified Professional Skills:
                </p>
                <div className="skills-container" style={{ marginTop: '15px' }}>
                  {res.extracted_skills?.map((s, i) => (
                    <span key={i} className="skill-tag matched">{s}</span>
                  ))}
                </div>

                {res.missing_skills && res.missing_skills.length > 0 && (
                  <>
                    <p style={{fontSize:'12px', fontWeight:'800', color: '#e11d48', marginTop:'25px', textTransform: 'uppercase', letterSpacing: '0.08em'}}>
                      ⚠️ Skill Gap (Learn these to get hired):
                    </p>
                    <div className="skills-container" style={{ marginTop: '15px' }}>
                      {res.missing_skills.map((s, i) => (
                        <span key={i} className="skill-tag missing">{s}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: '45px' }}>
                <h3 style={{ color: '#0f172a', fontWeight: '800', fontSize: '22px', marginBottom: '10px' }}>💼 Recommended Roles in India</h3>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '35px', fontWeight: '500' }}>
                  Top market opportunities identified across India based on your profile.
                </p>
                
                <div className="job-grid">
                  {res.recommended_jobs && res.recommended_jobs.length > 0 ? (
                    res.recommended_jobs.map((job, j) => (
                      <div key={j} className="job-card">
                        <div>
                          <div className="job-title" style={{ fontSize: '15px', marginBottom: '12px' }}>{job.title}</div>
                          <div className="job-company" style={{ fontWeight: '700' }}>🏢 {job.company}</div>
                          <div className="job-location" style={{ fontSize: '12px' }}>🇮🇳 {job.location}</div>
                        </div>
                        <a href={job.link} target="_blank" rel="noopener noreferrer" className="apply-btn">
                          Apply Now
                        </a>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No live Indian jobs found. Please try again later.</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;