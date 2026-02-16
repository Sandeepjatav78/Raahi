import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <main className="nf-page">
      <div className="nf-bg-glow" />
      <div className="nf-container">
        {/* Logo */}
        <div className="nf-logo-wrap">
          <img
            src="/logohorigental.svg"
            alt="TrackMate"
            className="nf-logo"
          />
        </div>

        {/* 404 Number */}
        <div className="nf-code-wrap">
          <span className="nf-code">4</span>
          <div className="nf-icon-ring">
            <svg className="nf-bus-icon" viewBox="0 0 64 64" fill="none">
              <rect x="12" y="8" width="40" height="40" rx="8" fill="#FF6B2C" />
              <rect x="18" y="14" width="28" height="14" rx="4" fill="#fff" opacity="0.9" />
              <rect x="18" y="14" width="13" height="14" rx="4" fill="#fff" opacity="0.9" />
              <rect x="33" y="14" width="13" height="14" rx="4" fill="#fff" opacity="0.9" />
              <circle cx="22" cy="48" r="5" fill="#334155" stroke="#FF6B2C" strokeWidth="2" />
              <circle cx="42" cy="48" r="5" fill="#334155" stroke="#FF6B2C" strokeWidth="2" />
              <rect x="28" y="32" width="8" height="10" rx="2" fill="#fff" opacity="0.5" />
            </svg>
          </div>
          <span className="nf-code">4</span>
        </div>

        {/* Message */}
        <h1 className="nf-title">Page Not Found</h1>
        <p className="nf-subtitle">
          The route you're looking for doesn't exist or has been moved.
          <br />Let's get you back on track.
        </p>

        {/* Actions */}
        <div className="nf-actions">
          <button onClick={() => navigate(-1)} className="nf-btn nf-btn-secondary">
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <button onClick={() => navigate('/login')} className="nf-btn nf-btn-primary">
            <Home className="w-4 h-4" />
            Home
          </button>
        </div>

        {/* Footer */}
        <p className="nf-footer">
          TrackMate &mdash; Smart Bus Tracking System
        </p>
      </div>
    </main>
  );
};

export default NotFound;
