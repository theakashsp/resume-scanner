import React, { useState } from "react";
import axios from "axios";
import "./App.css"; // IMPORTANT: Ensure this matches your file name
import Login from "./Login";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const API_BASE = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [files, setFiles] = useState([]);
  const [jobDescription, setJobDescription] = useState("");
  const [batchResults, setBatchResults] = useState([]);
  const [rankedCandidates, setRankedCandidates] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = (status) => setIsLoggedIn(status);
  const handleLogout = () => setIsLoggedIn(false);

  const handleUpload = async () => {
    if (!files || files.length === 0) { alert("Please select resume files"); return; }
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));

    try {
      setLoading(true); setError(""); setBatchResults([]);
      const response = await axios.post(`${API_BASE}/upload_resume/?job_description=${encodeURIComponent(jobDescription)}`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      setBatchResults(response.data.batch_results || []);
    } catch (err) { console.error(err); setError("Upload failed. Please check backend."); } finally { setLoading(false); }
  };

  const downloadReport = async (candidate) => {
    try {
      const response = await axios.post(`${API_BASE}/generate_report/`, candidate, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${candidate.filename || "Resume"}_Report.pdf`);
      document.body.appendChild(link); link.click(); link.remove();
    } catch (error) { alert("PDF download failed"); }
  };

  const fetchRanking = async () => {
    try { const response = await axios.get(`${API_BASE}/rank_candidates`); setRankedCandidates(response.data || []); } catch (err) { console.error(err); }
  };

  const fetchAnalytics = async () => {
    try { const response = await axios.get(`${API_BASE}/analytics`); setAnalytics(response.data || null); } catch (err) { console.error(err); }
  };

  if (!isLoggedIn) return <Login onLogin={handleLogin} />;

  return (
    <div className="App">
      <div className="header-row">
        <h1 className="main-title">🚀 AI Recruiter Pro</h1>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </div>

      {/* Upload Section */}
      <div className="card">
        <h2>📂 Upload Candidates</h2>
        <div className="upload-box">
          <input type="file" multiple onChange={(e) => setFiles(e.target.files)} />
          <p style={{ color: '#2563eb', fontWeight: '600' }}>
            {files.length > 0 ? `✅ ${files.length} Files Selected` : "📄 Drag & Drop Resumes Here"}
          </p>
        </div>
        <textarea placeholder="Paste Job Description (JD) here..." value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} rows={4} />
        <button className="primary-btn" onClick={handleUpload} disabled={loading}>
          {loading ? "⏳ Analyzing..." : "🚀 Upload & Analyze"}
        </button>
        {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
      </div>

      {/* Results Section */}
      {batchResults.length > 0 && (
        <div className="card">
          <h2>📊 Candidate Analysis</h2>
          {batchResults.map((res, index) => (
            <div key={index} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>{res.filename}</h3>
                <span style={{ 
                  background: res.status === 'Highly Recommended' ? '#dcfce7' : '#fef9c3', 
                  color: res.status === 'Highly Recommended' ? '#166534' : '#854d0e',
                  padding: '5px 10px', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold'
                }}>
                  {res.status}
                </span>
              </div>
              <p style={{ marginTop: '5px', color: '#64748b' }}>Match Score: <strong>{res.match_percentage}%</strong></p>

              {/* Matched Skills - Styled as Pills */}
              <p style={{fontSize:'13px', fontWeight:'600', marginTop:'10px'}}>Matched Skills:</p>
              <div className="skills-container">
                {res.matched_skills?.map((s, i) => <span key={i} className="skill-tag matched">{s}</span>)}
              </div>

              {/* Missing Skills - Styled as Pills */}
              <p style={{fontSize:'13px', fontWeight:'600', marginTop:'10px'}}>Missing Skills:</p>
              <div className="skills-container">
                {res.missing_skills?.map((s, i) => <span key={i} className="skill-tag missing">{s}</span>)}
              </div>

              <button className="secondary-btn" style={{ marginTop: '15px' }} onClick={() => downloadReport(res)}>
                📥 Download Report
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Ranking Section */}
      <div className="card">
        <h2>🏆 Candidate Ranking</h2>
        <button className="secondary-btn" onClick={fetchRanking} style={{ marginBottom: '15px' }}>🔄 Refresh Ranking</button>
        
        {rankedCandidates.length > 0 ? (
          <table className="ranking-table">
            <thead>
              <tr>
                <th>Candidate Name</th>
                <th>Match Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rankedCandidates.map((c, i) => (
                <tr key={i}>
                  <td>{c.filename}</td>
                  <td style={{ color: '#2563eb', fontWeight: 'bold' }}>{c.match_percentage}%</td>
                  <td>{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p style={{color:'#94a3b8', fontStyle:'italic'}}>No rankings yet.</p>}
      </div>

      {/* Analytics Section */}
      <div className="card">
        <h2>📈 Analytics Dashboard</h2>
        <button className="secondary-btn" onClick={fetchAnalytics} style={{ marginBottom: '15px' }}>📊 Load Charts</button>
        {analytics && (
           <div style={{ height: '300px' }}>
             <Bar
               data={{
                 labels: analytics.top_skills?.map(s => s[0]) || [],
                 datasets: [{ label: 'Skill Frequency', data: analytics.top_skills?.map(s => s[1]) || [], backgroundColor: '#3b82f6' }]
               }}
               options={{ maintainAspectRatio: false }}
             />
           </div>
        )}
      </div>
    </div>
  );
}

export default App;