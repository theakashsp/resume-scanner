import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './App.css';

// ── Navbar ──────────────────────────────────────────────────────────────────
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
      <button className="btn btn--glow">Get Started</button>
    </nav>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="hero" id="home">
      <div className="hero__grid-bg" aria-hidden="true" />
      <div className="hero__content">
        <span className="hero__badge">AI-Powered · Next Generation</span>
        <h1 className="hero__title">
          Land Your Dream Job<br />
          <span className="hero__title-accent">Faster with AI</span>
        </h1>
        <p className="hero__subtitle">
          Upload your resume. Our AI engine scans, scores, and matches you with
          the most relevant opportunities — in seconds.
        </p>
        <div className="hero__stats">
          <div className="hero__stat"><span className="hero__stat-num">98%</span><span>ATS Accuracy</span></div>
          <div className="hero__stat-divider" />
          <div className="hero__stat"><span className="hero__stat-num">50K+</span><span>Jobs Indexed</span></div>
          <div className="hero__stat-divider" />
          <div className="hero__stat"><span className="hero__stat-num">2.4s</span><span>Avg Scan Time</span></div>
        </div>
      </div>
      <div className="hero__orb hero__orb--blue" aria-hidden="true" />
      <div className="hero__orb hero__orb--purple" aria-hidden="true" />
    </section>
  );
}

// ── Step Progress (AI Terminal) ───────────────────────────────────────────────
function StepProgress({ steps, currentStep }) {
  const lines = [
    '> Initializing neural parser...',
    '> Extracting semantic embeddings...',
    '> Cross-referencing job corpus...',
    '> Ranking opportunities...',
    '> Generating ATS score...',
  ];
  return (
    <div className="terminal">
      <div className="terminal__header">
        <span className="terminal__dot terminal__dot--red" />
        <span className="terminal__dot terminal__dot--yellow" />
        <span className="terminal__dot terminal__dot--green" />
        <span className="terminal__title">resumeai-engine v3.1.0</span>
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

// ── ATS Score Ring ────────────────────────────────────────────────────────────
function AtsScoreRing({ score }) {
  const [displayed, setDisplayed] = useState(0);
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (displayed / 100) * circ;
  const color = score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';

  useEffect(() => {
    let frame;
    const target = score;
    let current = 0;
    const step = () => {
      current = Math.min(current + 1.5, target);
      setDisplayed(Math.round(current));
      if (current < target) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return (
    <div className="ats-ring">
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

// ── Job Card ──────────────────────────────────────────────────────────────────
function JobCard({ job, index }) {
  const matchColor = job.match_score >= 75 ? '#10B981' : job.match_score >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <div className="job-card" style={{ animationDelay: `${index * 80}ms` }}>
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
        {job.salary && <span className="job-card__tag job-card__tag--accent">{job.salary}</span>}
      </div>
      {job.description && (
        <p className="job-card__desc">{job.description.slice(0, 140)}...</p>
      )}
      <div className="job-card__footer">
        <div className="job-card__match-bar-track">
          <div className="job-card__match-bar-fill" style={{ width: `${job.match_score}%`, background: matchColor }} />
        </div>
        <button className="btn btn--sm btn--outline">View Job →</button>
      </div>
    </div>
  );
}

// ── Dropzone ──────────────────────────────────────────────────────────────────
function Dropzone({ onFileSelect, file, isDragging, onDragOver, onDragLeave, onDrop }) {
  const inputRef = useRef(null);
  return (
    <div
      className={`dropzone ${isDragging ? 'dropzone--drag' : ''} ${file ? 'dropzone--has-file' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => inputRef.current && inputRef.current.click()}
      role="button"
      tabIndex={0}
      aria-label="Upload resume"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        style={{ display: 'none' }}
        onChange={e => onFileSelect(e.target.files[0])}
      />
      <div className="dropzone__inner">
        <div className={`dropzone__icon-wrap ${isDragging ? 'dropzone__icon-wrap--pulse' : ''}`}>
          <svg className="dropzone__icon" viewBox="0 0 64 64" fill="none">
            <rect x="8" y="12" width="48" height="40" rx="6" stroke="currentColor" strokeWidth="2.5" />
            <path d="M32 36V22M32 22L26 28M32 22L38 28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M20 44h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          </svg>
        </div>
        {file ? (
          <div className="dropzone__file-info">
            <span className="dropzone__file-name">✓ {file.name}</span>
            <span className="dropzone__file-size">{(file.size / 1024).toFixed(1)} KB</span>
          </div>
        ) : (
          <>
            <p className="dropzone__primary">
              {isDragging ? 'Release to upload' : 'Drop your resume here'}
            </p>
            <p className="dropzone__secondary">or click to browse · PDF, DOC, DOCX</p>
          </>
        )}
      </div>
      <div className="dropzone__corner dropzone__corner--tl" aria-hidden="true" />
      <div className="dropzone__corner dropzone__corner--tr" aria-hidden="true" />
      <div className="dropzone__corner dropzone__corner--bl" aria-hidden="true" />
      <div className="dropzone__corner dropzone__corner--br" aria-hidden="true" />
    </div>
  );
}

// ── Features Section ──────────────────────────────────────────────────────────
function FeaturesSection() {
  const features = [
    { icon: '◈', title: 'ATS Score Analysis', desc: 'Our AI grades your resume against real ATS systems used by Fortune 500 companies.' },
    { icon: '◎', title: 'Semantic Job Matching', desc: 'Deep NLP extracts skills and experience to find jobs that truly fit your profile.' },
    { icon: '◇', title: 'Keyword Optimization', desc: 'Instantly see which high-value keywords you are missing for your target roles.' },
    { icon: '◉', title: 'Real-Time Indexing', desc: '50,000+ live job listings refreshed every hour from top hiring platforms.' },
  ];
  return (
    <section className="features" id="features">
      <div className="section-label">Platform Features</div>
      <h2 className="section-title">Built for the Modern Job Seeker</h2>
      <div className="features__grid">
        {features.map((f, i) => (
          <div className="feature-card" key={i} style={{ animationDelay: `${i * 100}ms` }}>
            <span className="feature-card__icon">{f.icon}</span>
            <h3 className="feature-card__title">{f.title}</h3>
            <p className="feature-card__desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="footer">
      <div className="footer__top">
        <div className="footer__brand">
          <span className="navbar__logo-text">ResumeAI<span className="navbar__logo-accent">X</span></span>
          <p className="footer__tagline">AI-powered career acceleration platform for the next generation of professionals.</p>
          <div className="footer__socials">
            <a href="#!" aria-label="Twitter" className="footer__social">𝕏</a>
            <a href="#!" aria-label="LinkedIn" className="footer__social">in</a>
            <a href="#!" aria-label="GitHub" className="footer__social">⌥</a>
          </div>
        </div>
        <div className="footer__col">
          <h4>Product</h4>
          <a href="#!">Resume Scanner</a>
          <a href="#!">Job Matcher</a>
          <a href="#!">ATS Optimizer</a>
          <a href="#!">Career Dashboard</a>
        </div>
        <div className="footer__col">
          <h4>Company</h4>
          <a href="#!">About Us</a>
          <a href="#!">Blog</a>
          <a href="#!">Careers</a>
          <a href="#!">Press Kit</a>
        </div>
        <div className="footer__col">
          <h4>Support</h4>
          <a href="#!">Documentation</a>
          <a href="#!">Help Center</a>
          <a href="#!">Privacy Policy</a>
          <a href="#!">Terms of Service</a>
        </div>
      </div>
      <div className="footer__bottom">
        <span>© {new Date().getFullYear()} ResumeAIX. All rights reserved.</span>
        <span className="footer__badge">SOC 2 Compliant · 256-bit Encrypted</span>
      </div>
    </footer>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
function App() {
  // ── YOUR ORIGINAL STATE — UNTOUCHED ──
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const steps = [
    'Parsing document structure',
    'Extracting skills & experience',
    'Querying job database',
    'Computing match scores',
    'Finalizing ATS analysis',
  ];

  // ── YOUR ORIGINAL AXIOS LOGIC — UNTOUCHED ──
  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setCurrentStep(0);

    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= steps.length - 1) { clearInterval(interval); return prev; }
        return prev + 1;
      });
    }, 1200);

    try {
      const formData = new FormData();
      formData.append('resume', file);
      const response = await axios.post('http://localhost:5000/api/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      clearInterval(interval);
      setCurrentStep(steps.length);
      setResults(response.data);
    } catch (err) {
      clearInterval(interval);
      setError(err.response?.data?.message || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver  = useCallback(e => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleDrop      = useCallback(e => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }, []);

  return (
    <div className="app">
      <Navbar />
      <Hero />

      {/* ── Upload / Dashboard Section ── */}
      <section className="upload-section" id="dashboard">
        <div className="section-label">AI Resume Engine</div>
        <h2 className="section-title">Scan &amp; Match in Seconds</h2>
        <p className="section-subtitle">
          Upload once. Get an ATS score, keyword gaps, and tailored job matches instantly.
        </p>

        <div className="upload-panel">
          <Dropzone
            file={file}
            isDragging={isDragging}
            onFileSelect={setFile}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />

          <button
            className={`btn btn--primary btn--lg btn--glow ${loading || !file ? 'btn--disabled' : ''}`}
            onClick={handleSubmit}
            disabled={loading || !file}
          >
            {loading ? (
              <><span className="btn__spinner" /> Analyzing Resume...</>
            ) : (
              '⚡ Analyze My Resume'
            )}
          </button>

          {error && (
            <div className="alert alert--error">
              <span>⚠</span> {error}
            </div>
          )}
        </div>

        {loading && (
          <div className="terminal-wrap">
            <StepProgress steps={steps} currentStep={currentStep} />
          </div>
        )}

        {results && (
          <div className="results">
            {/* ATS Score */}
            <div className="results__score-section">
              <AtsScoreRing score={results.ats_score ?? 0} />
              <div className="results__score-meta">
                <h3>Your Resume Score</h3>
                <p className="results__score-desc">
                  {results.ats_score >= 75
                    ? 'Excellent! Your resume is highly ATS-compatible.'
                    : results.ats_score >= 50
                    ? 'Good foundation — a few targeted improvements will boost your score.'
                    : 'Your resume needs optimization to pass ATS filters.'}
                </p>
                {results.keywords && results.keywords.length > 0 && (
                  <div className="results__keywords">
                    <p className="results__keywords-label">Top Keywords Detected</p>
                    <div className="results__keywords-list">
                      {results.keywords.map((kw, i) => (
                        <span key={i} className="kw-chip">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Job Recommendations */}
            {results.jobs && results.jobs.length > 0 && (
              <div className="results__jobs">
                <div className="results__jobs-header">
                  <h3>Recommended Jobs <span className="badge">{results.jobs.length} matches</span></h3>
                  <p className="results__jobs-sub">Ranked by AI-computed compatibility with your resume</p>
                </div>
                <div className="jobs-grid">
                  {results.jobs.map((job, i) => (
                    <JobCard key={i} job={job} index={i} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <FeaturesSection />
      <Footer />
    </div>
  );
}

export default App;