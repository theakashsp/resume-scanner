import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
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
    '> Gemini ATS scoring...',
    '> Fetching live jobs (Remotive)...',
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
  const matchColor = job.match_score >= 75 ? '#10B981' : job.match_score >= 50 ? '#F59E0B' : '#EF4444';
  const href = job.url || job.link || '#';
  return (
    <div className="job-card job-card--live" style={{ animationDelay: `${index * 90}ms` }}>
      <div className="job-card__header">
        <div className="job-card__company-logo">
          {(job.company || 'C').charAt(0).toUpperCase()}
        </div>
        <div className="job-card__meta">
          <h3 className="job-card__title">{job.title}</h3>
          <p className="job-card__company">{job.company}</p>
        </div>
        <div className="job-card__score" style={{ color: matchColor, borderColor: matchColor }}>
          {job.match_score}%
        </div>
      </div>
      <div className="job-card__tags">
        {job.location && <span className="job-card__tag">📍 {job.location}</span>}
        {job.type && <span className="job-card__tag">{job.type}</span>}
      </div>
      <div className="job-card__footer job-card__footer--apply">
        <div className="job-card__match-bar-track">
          <div className="job-card__match-bar-fill" style={{ width: `${job.match_score}%`, background: matchColor }} />
        </div>
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
            </div>
          </div>

          {results.jobs && results.jobs.length > 0 && (
            <div className="live-jobs">
              <h3 className="live-jobs__title">Live job matches</h3>
              <p className="live-jobs__sub">Pulled from Remotive — apply in one click</p>
              <div className="jobs-grid jobs-grid--three">
                {results.jobs.map((job, i) => (
                  <JobMatchCard key={i} job={job} index={i} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <FeaturesSection />
      <Footer />
    </div>
  );
}

export default App;
