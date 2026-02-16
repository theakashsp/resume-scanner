import React, { useState } from "react";
import axios from "axios";
import "./App.css";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const API_BASE =
  process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

function App() {
  const [files, setFiles] = useState([]);
  const [jobDescription, setJobDescription] = useState("");
  const [batchResults, setBatchResults] = useState([]);
  const [rankedCandidates, setRankedCandidates] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ===============================
  // Upload Resumes
  // ===============================
  const handleUpload = async () => {
    if (!files || files.length === 0) {
      alert("Please select resume files");
      return;
    }

    const formData = new FormData();
    Array.from(files).forEach((file) =>
      formData.append("files", file)
    );

    try {
      setLoading(true);
      setError("");
      setBatchResults([]);

      const response = await axios.post(
        `${API_BASE}/upload_resume/?job_description=${encodeURIComponent(
          jobDescription
        )}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setBatchResults(response.data.batch_results || []);
    } catch (err) {
      console.error(err);
      setError("Upload failed. Please check backend.");
    } finally {
      setLoading(false);
    }
  };

  // ===============================
  // Download Report
  // ===============================
  const downloadReport = async (candidate) => {
    try {
      const response = await axios.post(
        `${API_BASE}/generate_report/`,
        candidate,
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(
        new Blob([response.data])
      );

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${candidate.filename}_Report.pdf`
      );
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error("Report error:", err);
    }
  };

  // ===============================
  // Ranking
  // ===============================
  const fetchRanking = async () => {
    try {
      const response = await axios.get(
        `${API_BASE}/rank_candidates`
      );
      setRankedCandidates(response.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // ===============================
  // Analytics
  // ===============================
  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(
        `${API_BASE}/analytics`
      );
      setAnalytics(response.data || null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="App">

      <h1 className="main-title">
        🚀 AI Career Resume Scanner
      </h1>

      {/* ================= Upload Section ================= */}
      <div className="card upload-card">
        <h2>Upload Resumes</h2>

        <input
          type="file"
          multiple
          onChange={(e) => setFiles(e.target.files)}
        />

        <textarea
          placeholder="Paste Job Description Here"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          rows={5}
        />

        <button onClick={handleUpload} disabled={loading}>
          {loading ? "Analyzing..." : "Upload & Analyze"}
        </button>

        {error && <p className="error">{error}</p>}
      </div>

      {/* ================= Batch Results ================= */}
      {batchResults.length > 0 && (
        <div className="card">
          <h2>📊 Candidate Analysis</h2>

          {batchResults.map((res, index) => (
            <div key={index} className="result-card">

              <div className="result-header">
                <h3>{res.filename}</h3>
                <span className="status-badge">
                  {res.status || "N/A"}
                </span>
              </div>

              <p>
                <strong>Match Percentage:</strong>{" "}
                {res.match_percentage ?? 0}%
              </p>

              <div className="skills-grid">

                <div className="skills-box matched">
                  <h4>Matched Skills</h4>
                  <ul>
                    {(res.matched_skills || []).map((skill, i) => (
                      <li key={i}>{skill}</li>
                    ))}
                  </ul>
                </div>

                <div className="skills-box missing">
                  <h4>Missing Skills</h4>
                  <ul>
                    {(res.missing_skills || []).map((skill, i) => (
                      <li key={i}>{skill}</li>
                    ))}
                  </ul>
                </div>

              </div>

              {res.recommendations &&
                res.recommendations.length > 0 && (
                  <div className="recommendation-box">
                    <h4>📌 Career Recommendations</h4>
                    <ul>
                      {res.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

              <div className="report-section">
                <button
                  className="download-btn"
                  onClick={() => downloadReport(res)}
                >
                  Download PDF Report
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* ================= Ranking Section ================= */}
      <div className="card">
        <h2>🏆 Candidate Ranking</h2>
        <button onClick={fetchRanking}>
          Load Ranking
        </button>

        {rankedCandidates.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Filename</th>
                <th>Match %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rankedCandidates.map((candidate, index) => (
                <tr key={index}>
                  <td>{candidate.filename}</td>
                  <td>{candidate.match_percentage}%</td>
                  <td>{candidate.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ================= Analytics Section ================= */}
      <div className="card">
        <h2>📈 Analytics Dashboard</h2>
        <button onClick={fetchAnalytics}>
          Load Analytics
        </button>

        {analytics && (
          <div>
            <p><strong>Total Resumes:</strong> {analytics.total_resumes}</p>
            <p><strong>Average Match:</strong> {analytics.average_match}%</p>
            <p><strong>Highest Match:</strong> {analytics.highest_match}%</p>

            {analytics.top_skills &&
              analytics.top_skills.length > 0 && (
                <Bar
                  data={{
                    labels: analytics.top_skills.map(
                      (skill) => skill[0]
                    ),
                    datasets: [
                      {
                        label: "Skill Frequency",
                        data: analytics.top_skills.map(
                          (skill) => skill[1]
                        ),
                        backgroundColor:
                          "rgba(37, 99, 235, 0.7)",
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { display: false },
                      title: {
                        display: true,
                        text: "Top Skills Distribution",
                      },
                    },
                  }}
                />
              )}
          </div>
        )}
      </div>

    </div>
  );
}

export default App;
