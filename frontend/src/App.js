import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import TechBackground3D from './TechBackground3D';
import MainAmbient3D from './MainAmbient3D';
import './App.css';

function getApiOrigin() {
  const raw = process.env.REACT_APP_API_URL;
  if (raw != null && String(raw).trim() !== '') {
    return String(raw).trim().replace(/\/$/, '');
  }
  return 'http://127.0.0.1:8000';
}

function getAnalyzeUrl() {
  return `${getApiOrigin()}/analyze`;
}

function formatApiError(err) {
  const status = err.response?.status;
  const data = err.response?.data;
  let msg = data?.message;
  const d = data?.detail;
  if (!msg && typeof d === 'string') msg = d;
  if (!msg && Array.isArray(d)) {
    msg = d
      .map((x) => (typeof x === 'string' ? x : x?.msg))
      .filter(Boolean)
      .join('; ');
  }
  if (msg) return msg;
  if (status) return `Request failed with status code ${status}`;
  return err.message || 'Analysis failed. Please try again.';
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <div className="navbar__brand">
        <span className="navbar__logo-icon">⬡</span>
        <span className="navbar__logo-text">ResumeAI<span className="navbar__logo-accent">X</span></span>
      </div>
      <ul className="navbar__links">
        <li><a href="#home">Home</a></li>
        <li><a href="#dashboard">Dashboard</a></li>
        <li><a href="#features">Features</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
      <button type="button" className="btn btn--nav-white">Get Started</button>
    </nav>
  );
}

function HeroUpload({
  file,
  setFile,
  loading,
  error,
  onAnalyze,
}) {
  const onDrop = useCallback((accepted) => {
    if (accepted?.[0]) setFile(accepted[0]);
  }, [setFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    multiple: false,
    disabled: loading,
  });

  return (
    <div className="hero-upload">
      <div
        {...getRootProps()}
        className={`dropzone dropzone--hero ${isDragActive ? 'dropzone--drag' : ''} ${file ? 'dropzone--has-file' : ''} ${loading ? 'dropzone--disabled' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="dropzone__inner">
          <div className={`dropzone__icon-wrap ${isDragActive ? 'dropzone__icon-wrap--pulse' : ''}`}>
            {file ? (
              <span className="dropzone__check" aria-hidden="true">✓</span>
            ) : (
              <svg className="dropzone__icon" viewBox="0 0 64 64" fill="none">
                <rect x="8" y="12" width="48" height="40" rx="6" stroke="currentColor" strokeWidth="2.5" />
                <path d="M32 36V22M32 22L26 28M32 22L38 28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M20 44h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
              </svg>
            )}
          </div>
          {file ? (
            <div className="dropzone__file-info">
              <span className="dropzone__file-name dropzone__file-name--ok">{file.name}</span>
              <span className="dropzone__file-size">{(file.size / 1024).toFixed(1)} KB</span>
            </div>
          ) : (
            <>
              <p className="dropzone__primary">
                {isDragActive ? 'Release to upload PDF' : 'Drag & drop your resume (PDF)'}
              </p>
              <p className="dropzone__secondary">or click to browse · PDF only</p>
            </>
          )}
        </div>
        <div className="dropzone__corner dropzone__corner--tl" aria-hidden="true" />
        <div className="dropzone__corner dropzone__corner--tr" aria-hidden="true" />
        <div className="dropzone__corner dropzone__corner--bl" aria-hidden="true" />
        <div className="dropzone__corner dropzone__corner--br" aria-hidden="true" />
      </div>

      <button
        type="button"
        className={`btn btn--primary btn--lg btn--glow hero-upload__cta ${loading || !file ? 'btn--disabled' : ''}`}
        onClick={onAnalyze}
        disabled={loading || !file}
      >
        {loading ? (
          <><span className="btn__spinner" /> Analyzing Resume...</>
        ) : (
          '⚡ Analyze My Resume'
        )}
      </button>

      {error && (
        <div className="alert alert--error" role="alert">
          <span className="alert__icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function StepProgress({ steps, currentStep }) {
  const lines = [
    '> Initializing neural parser...',
    '> Extracting semantic embeddings...',
    '> Gemini career counseling...',
    '> Fetching real-time India jobs (JSearch)...',
    '> Building your dashboard...',
  ];
  return (
    <div className="terminal">
      <div className="terminal__header">
        <span className="terminal__dot terminal__dot--red" />
        <span className="terminal__dot terminal__dot--yellow" />
        <span className="terminal__dot terminal__dot--green" />
        <span className="terminal__title">resumeaix-engine v2.0</span>
      </div>
      <div className="terminal__body">
        {steps.map((step, i) => (
          <div key={i} className={`terminal__line ${i < currentStep ? 'terminal__line--done' : ''} ${i === currentStep ? 'terminal__line--active' : ''} ${i > currentStep ? 'terminal__line--pending' : ''}`}>
            <span className="terminal__prefix">
              {i < currentStep ? '✓' : i === currentStep ? '›' : '○'}
            </span>
            <span className="terminal__text">{i <= currentStep ? lines[i] || step : step}</span>
            {i === currentStep && <span className="terminal__cursor" />}
            {i < currentStep && <span className="terminal__done-badge">DONE</span>}
          </div>
        ))}
        {currentStep >= steps.length && (
          <div className="terminal__complete">
            <span className="terminal__complete-icon">✦</span> Analysis complete. Results ready.
          </div>
        )}
      </div>
      <div className="terminal__progress">
        <div
          className="terminal__progress-bar"
          style={{ width: `${Math.min((currentStep / steps.length) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

function AtsScoreRing({ score }) {
  const [displayed, setDisplayed] = useState(0);
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (displayed / 100) * circ;
  const color = score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';

  useEffect(() => {
    let frame;
    let current = 0;
    const target = score;
    const step = () => {
      current = Math.min(current + 1.5, target);
      setDisplayed(Math.round(current));
      if (current < target) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return (
    <div className="ats-ring ats-ring--loop">
      <svg viewBox="0 0 128 128" className="ats-ring__svg">
        <circle cx="64" cy="64" r={radius} className="ats-ring__track" />
        <circle
          cx="64" cy="64" r={radius}
          className="ats-ring__fill"
          style={{ strokeDasharray: circ, strokeDashoffset: offset, stroke: color }}
        />
      </svg>
      <div className="ats-ring__label">
        <span className="ats-ring__score" style={{ color }}>{displayed}</span>
        <span className="ats-ring__unit">/ 100</span>
        <span className="ats-ring__caption">ATS Score</span>
      </div>
    </div>
  );
}

function JobMatchCard({ job, index }) {
  const href = job.job_apply_link || '#';
  return (
    <div className="job-card job-card--live" style={{ animationDelay: `${index * 90}ms` }}>
      <div className="job-card__header">
        <div className="job-card__company-logo">
          {(job.employer_name || 'C').charAt(0).toUpperCase()}
        </div>
        <div className="job-card__meta">
          <h3 className="job-card__title">{job.job_title}</h3>
          <p className="job-card__company">{job.employer_name}</p>
        </div>
      </div>
      <div className="job-card__tags">
        {job.location && <span className="job-card__tag">📍 {job.location}</span>}
        {job.job_employment_type && <span className="job-card__tag">{job.job_employment_type}</span>}
      </div>
      <div className="job-card__footer job-card__footer--apply">
        <a
          className="btn btn--sm btn--apply"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
        >
          Apply Now
        </a>
      </div>
    </div>
  );
}

function RoleJobsSection({ roleName, jobs }) {
  return (
    <div className="live-jobs" style={{ marginTop: 20 }}>
      <h3 className="live-jobs__title" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {roleName}
      </h3>
      <p className="live-jobs__sub">Actively hiring in India for this role</p>
      <div className="jobs-grid jobs-grid--three">
        {(jobs || []).length > 0 ? (
          jobs.map((job, i) => <JobMatchCard key={`${roleName}-${i}`} job={job} index={i} />)
        ) : (
          <p className="section-subtitle">No live jobs found for this role right now.</p>
        )}
      </div>
    </div>
  );
}

function FeaturesSection() {
  const features = [
    { icon: '◈', title: 'ATS Score Analysis', desc: 'Gemini 2.5 Flash grades your resume like a real ATS.' },
    { icon: '◎', title: 'Skill Match & Gaps', desc: 'See matched strengths and missing keywords instantly.' },
    { icon: '◇', title: 'Live Remotive Jobs', desc: 'Three fresh remote listings aligned to your predicted role.' },
    { icon: '◉', title: 'Glassmorphism UI', desc: 'Futuristic dark interface with 3D neural background.' },
  ];
  return (
    <section className="features" id="features">
      <div className="section-label">Platform Features</div>
      <h2 className="section-title">Built for the Modern Job Seeker</h2>
      <div className="features__grid">
        {features.map((f, i) => (
          <div className="feature-card feature-card--loop" key={i} style={{ animationDelay: `${i * 100}ms` }}>
            <span className="feature-card__icon">{f.icon}</span>
            <h3 className="feature-card__title">{f.title}</h3>
            <p className="feature-card__desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer" id="contact">
      <div className="footer__top">
        <div className="footer__brand">
          <span className="navbar__logo-text">ResumeAI<span className="navbar__logo-accent">X</span></span>
          <p className="footer__tagline">AI-powered resume intelligence — ATS scoring, gaps, and live job matches.</p>
          <div className="footer__socials">
            <a href="#!" aria-label="Twitter" className="footer__social">𝕏</a>
            <a href="#!" aria-label="LinkedIn" className="footer__social">in</a>
            <a href="#!" aria-label="GitHub" className="footer__social">⌥</a>
          </div>
        </div>
        <div className="footer__col">
          <h4>Product</h4>
          <a href="#dashboard">Resume Scanner</a>
          <a href="#dashboard">Job Matcher</a>
          <a href="#features">Features</a>
        </div>
        <div className="footer__col" id="about">
          <h4>Company</h4>
          <a href="#!">About</a>
          <a href="#!">Blog</a>
        </div>
        <div className="footer__col">
          <h4>Support</h4>
          <a href="#!">Privacy</a>
          <a href="#!">Terms</a>
        </div>
      </div>
      <div className="footer__bottom">
        <span>© {new Date().getFullYear()} ResumeAIX</span>
        <span className="footer__badge">Gemini · Remotive · FastAPI</span>
      </div>
    </footer>
  );
}

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const steps = [
    'Parsing document structure',
    'Extracting skills & experience',
    'AI ATS scoring',
    'Live job search',
    'Finalizing dashboard',
  ];

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setCurrentStep(0);

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= steps.length - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 1100);

    try {
      const formData = new FormData();
      formData.append('file', file, file.name);
      const response = await axios.post(getAnalyzeUrl(), formData);
      clearInterval(interval);
      setCurrentStep(steps.length);
      setResults(response.data);
    } catch (err) {
      clearInterval(interval);
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const matched = results?.matched_skills ?? [];
  const missing = results?.missing_skills ?? [];
  const role = results?.predicted_role;
  const roadmap = results?.learning_roadmap ?? [];
  const counselorSuggestion = results?.custom_suggestion ?? '';
  const candidateName = results?.candidate_name || 'Not found';
  const candidateEmail = results?.candidate_email || 'Not found';
  const candidatePhone = results?.candidate_phone || 'Not found';
  const candidateCollege = results?.candidate_college || 'Not found';
  const recommendedRoles = results?.recommended_roles ?? [];
  const jobsByRole = results?.jobs_by_role ?? {};

  const generatePDFReport = () => {
    if (!results) return;
    const doc = new jsPDF();
    let y = 16;

    doc.setFontSize(18);
    doc.text('ResumeAIX Career Report', 14, y);
    y += 8;

    doc.setFontSize(11);
    doc.text(`Candidate Name: ${candidateName}`, 14, y);
    y += 6;
    doc.text(`Candidate Email: ${candidateEmail}`, 14, y);
    y += 6;
    doc.text(`Candidate Phone: ${candidatePhone}`, 14, y);
    y += 6;
    doc.text(`College: ${candidateCollege}`, 14, y);
    y += 6;
    doc.text(`Predicted Role: ${role || 'N/A'}`, 14, y);
    y += 6;
    doc.text(`Recommended Roles: ${(recommendedRoles || []).join(', ') || 'N/A'}`, 14, y, { maxWidth: 180 });
    y += 6;
    doc.text(`ATS Score: ${results.ats_score ?? 0}/100`, 14, y);
    y += 10;

    doc.setFontSize(13);
    doc.text('Missing Skills', 14, y);
    y += 6;
    doc.setFontSize(11);
    doc.text((missing.length ? missing.join(', ') : 'No missing skills detected.'), 14, y, { maxWidth: 180 });
    y += 12;

    doc.setFontSize(13);
    doc.text('Learning Roadmap', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Step', 'Title', 'Focus', 'Project Idea']],
      body: (roadmap.length ? roadmap : [{ step: 1, title: 'Roadmap unavailable', focus: '-', project_idea: '-' }]).map((step) => [
        String(step.step ?? ''),
        String(step.title ?? ''),
        String(step.focus ?? ''),
        String(step.project_idea ?? ''),
      ]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [17, 24, 39] },
    });

    y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : y + 20;
    doc.setFontSize(13);
    doc.text('Actively Hiring Companies (India)', 14, y);
    y += 4;
    const rows = [];
    Object.entries(jobsByRole).forEach(([roleKey, roleJobs]) => {
      (roleJobs || []).forEach((job) => {
        rows.push([
          roleKey,
          String(job.employer_name || ''),
          String(job.job_title || ''),
          String(job.job_apply_link || ''),
        ]);
      });
    });
    autoTable(doc, {
      startY: y,
      head: [['Role', 'Company', 'Job Title', 'Apply Link']],
      body: rows.length ? rows : [['-', '-', '-', '-']],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [20, 83, 45] },
    });

    y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : y + 20;
    doc.setFontSize(13);
    doc.text('AI Counselor Suggestion', 14, y);
    y += 6;
    doc.setFontSize(10);
    doc.text(counselorSuggestion || 'No suggestion available.', 14, y, { maxWidth: 180 });

    doc.save('ResumeAIX-Career-Report.pdf');
  };

  return (
    <div className="app">
      <div className="app__ambient-3d" aria-hidden="true">
        <MainAmbient3D />
      </div>
      <Navbar />

      <section className="hero" id="home">
        <div className="hero__canvas-bg" aria-hidden="true">
          <TechBackground3D />
        </div>
        <div className="hero__grid-bg" aria-hidden="true" />
        <div className="hero__aurora" aria-hidden="true" />
        <div className="hero__content hero__content--with-upload">
          <span className="hero__badge hero__badge--pulse">AI-Powered · Gemini 2.5 Flash</span>
          <h1 className="hero__title">
            Resume AI Analyzer<br />
            <span className="hero__title-accent">ResumeAIX</span>
          </h1>
          <p className="hero__subtitle">
            Drop your PDF. We extract text, score ATS fit, surface skill gaps, and pull live remote jobs from Remotive.
          </p>

          <HeroUpload
            file={file}
            setFile={setFile}
            loading={loading}
            error={error}
            onAnalyze={handleAnalyze}
          />
        </div>
        <div className="hero__orb hero__orb--blue" aria-hidden="true" />
        <div className="hero__orb hero__orb--purple" aria-hidden="true" />
      </section>

      {loading && (
        <div className="terminal-wrap">
          <StepProgress steps={steps} currentStep={currentStep} />
        </div>
      )}

      {results && (
        <section className="dashboard-section glass-section" id="dashboard">
          <div className="section-label">Results Dashboard</div>
          <h2 className="section-title">Your analysis is ready</h2>
          {role && (
            <p className="section-subtitle dashboard-role">
              Predicted role: <strong>{role}</strong>
            </p>
          )}
          <p className="section-subtitle dashboard-role">
            Candidate: <strong>{candidateName}</strong> ({candidateEmail})
          </p>
          <p className="section-subtitle dashboard-role">
            Phone: <strong>{candidatePhone}</strong> · College: <strong>{candidateCollege}</strong>
          </p>
          <p className="section-subtitle dashboard-role">
            Recommended roles:{' '}
            {recommendedRoles.length > 0 ? (
              recommendedRoles.map((r, i) => (
                <strong key={r}>{i ? `, ${r.toUpperCase()}` : r.toUpperCase()}</strong>
              ))
            ) : (
              <strong>{(role || 'Not available').toUpperCase()}</strong>
            )}
          </p>

          <div className="dashboard-grid">
            <div className="dashboard-card dashboard-card--score">
              <AtsScoreRing score={results.ats_score ?? 0} />
              <p className="dashboard-hint">
                {results.ats_score >= 75
                  ? 'Strong ATS alignment for your target role.'
                  : results.ats_score >= 50
                  ? 'Solid base — close skill gaps to climb higher.'
                  : 'Prioritize missing keywords and structure for ATS.'}
              </p>
            </div>

            <div className="dashboard-card dashboard-card--skills">
              <h3 className="dashboard-card__title">Matched skills</h3>
              <ul className="skill-list skill-list--matched">
                {matched.length > 0 ? matched.map((s, i) => (
                  <li key={i}>{s}</li>
                )) : (
                  <li className="skill-list__empty">No explicit matches — try a richer PDF.</li>
                )}
              </ul>
              <h3 className="dashboard-card__title dashboard-card__title--spaced">Missing / gaps</h3>
              <div className="gap-chips">
                {missing.length > 0 ? missing.map((s, i) => (
                  <span className="gap-chip" key={i}>{s}</span>
                )) : (
                  <span className="skill-list__empty">No gaps listed — great coverage.</span>
                )}
              </div>
              {roadmap.length > 0 && (
                <>
                  <h3 className="dashboard-card__title dashboard-card__title--spaced">Learning roadmap</h3>
                  <ul className="skill-list skill-list--matched">
                    {roadmap.map((step, idx) => (
                      <li key={idx}>
                        <strong>Step {step.step}:</strong> {step.title} - {step.focus} (Project: {step.project_idea})
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {counselorSuggestion && (
                <>
                  <h3 className="dashboard-card__title dashboard-card__title--spaced">AI counselor suggestion</h3>
                  <p className="section-subtitle">{counselorSuggestion}</p>
                </>
              )}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <button type="button" className="btn btn--primary btn--lg" onClick={generatePDFReport}>
              Download Career Report
            </button>
          </div>

          <div className="live-jobs">
            <h3 className="live-jobs__title">Multi-role live job matches</h3>
            <p className="live-jobs__sub">
              Pulled from JSearch (India). Apply opens the real company portal in a new tab.
            </p>
            {Object.entries(jobsByRole).map(([roleName, jobs]) => (
              <RoleJobsSection key={roleName} roleName={roleName} jobs={jobs} />
            ))}
          </div>
        </section>
      )}

      <FeaturesSection />
      <Footer />
    </div>
  );
}

export default App;
