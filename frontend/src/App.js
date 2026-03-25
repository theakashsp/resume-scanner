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
      setTimeout(() => setStatusMsg("EVALUATING MULTIPLE CAREER PATHS..."), 2000);
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

  // Updated to accept both the root file result and the specific career path
  const handleDownloadPDF = async (res, path) => {
    try {
      const response = await axios.post(`${API_BASE}/generate_report/`, {
        filename: res.filename,
        predicted_role: path.predicted_role,
        extracted_skills: res.extracted_skills, // All skills found
        missing_skills: path.missing_skills,    // Skills missing for THIS role
        ats_score: path.ats_score               // Score for THIS role
      }, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${res.filename.split('.')[0]}_${path.predicted_role.replace(/\s+/g, '_')}_Report.pdf`);
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
          Let our AI analyze your skills, calculate your ATS score, and find the best live jobs across multiple tech roles.
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
              {/* Loop through the newly created career_paths array from the backend */}
              {res.career_paths && res.career_paths.map((path, pIndex) => (
                <div key={pIndex} style={{ background: '#eff6ff', padding: '35px', borderRadius: '24px', border: '1px solid #bfdbfe', marginBottom: '45px', position: 'relative' }}>
                  
                  {/* Badge indicating match strength */}
                  <div style={{ position: 'absolute', top: '-15px', left: '35px', background: pIndex === 0 ? '#3b82f6' : '#64748b', color: 'white', padding: '5px 15px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                    {pIndex === 0 ? "🥇 Top Match" : pIndex === 1 ? "🥈 Strong Match" : "🥉 Alternative Path"}
                  </div>

                  <button 
                    onClick={() => handleDownloadPDF(res, path)}
                    className="secondary-btn"
                    style={{ position: 'absolute', top: '35px', right: '35px' }}
                  >
                    📥 Download PDF
                  </button>

                  <h3 style={{ color: '#1e40af', marginBottom: '25px', fontSize: '28px', fontWeight: '800', marginTop: '10px' }}>
                    Predicted Role: {path.predicted_role}
                  </h3>
                  
                  <div className="ats-container">
                    <div className="ats-header">
                      <span className="ats-title">ATS Match Score</span>
                      <span className="ats-score-text">{path.ats_score ? path.ats_score : '75'}%</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: `${path.ats_score ? path.ats_score : 75}%`, backgroundColor: path.ats_score > 70 ? '#22c55e' : '#eab308' }}></div>
                    </div>
                  </div>

                  <p style={{fontSize:'12px', fontWeight:'800', color: '#64748b', marginTop:'25px', textTransform: 'uppercase', letterSpacing: '0.08em'}}>
                    ✅ Verified Professional Skills for this role:
                  </p>
                  <div className="skills-container" style={{ marginTop: '15px' }}>
                    {path.matched_skills?.length > 0 ? path.matched_skills.map((s, i) => (
                      <span key={i} className="skill-tag matched">{s}</span>
                    )) : <span style={{fontSize: '14px', color: '#64748b'}}>No core skills matched.</span>}
                  </div>

                  {path.missing_skills && path.missing_skills.length > 0 && (
                    <>
                      <p style={{fontSize:'12px', fontWeight:'800', color: '#e11d48', marginTop:'25px', textTransform: 'uppercase', letterSpacing: '0.08em'}}>
                        ⚠️ Skill Gap (Learn these to get hired):
                      </p>
                      <div className="skills-container" style={{ marginTop: '15px' }}>
                        {path.missing_skills.map((s, i) => (
                          <span key={i} className="skill-tag missing">{s}</span>
                        ))}
                      </div>
                    </>
                  )}
                

                  <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '30px', marginTop: '30px' }}>
                    <h3 style={{ color: '#0f172a', fontWeight: '800', fontSize: '20px', marginBottom: '10px' }}>💼 Recommended Jobs for {path.predicted_role}</h3>
                    
                    <div className="job-grid">
                      {path.recommended_jobs && path.recommended_jobs.length > 0 ? (
                        path.recommended_jobs.map((job, j) => (
                          <div key={j} className="job-card" style={{ background: 'white' }}>
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
                        <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No live jobs found for this specific role.</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;