import { useCallback, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import { Eye, EyeOff, Loader2, UserPlus, LogIn, CheckCircle, X, BusFront, KeyRound, MapPin, Shield, Bell } from 'lucide-react';

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotResult, setForgotResult] = useState(null); // { type: 'success'|'error', message }
  const [heroPointer, setHeroPointer] = useState({ x: 50, y: 50 });
  const { login, user } = useAuth();

  const heroCircles = useMemo(
    () => [
      { size: 300, left: -12, top: -10, depth: 6, opacity: 0.14 },
      { size: 180, left: 70, top: -8, depth: 10, opacity: 0.18 },
      { size: 240, left: 55, top: 18, depth: 12, opacity: 0.12 },
      { size: 140, left: 10, top: 22, depth: 8, opacity: 0.16 },
      { size: 90, left: 35, top: 30, depth: 16, opacity: 0.22 },
      { size: 220, left: -8, top: 45, depth: 11, opacity: 0.12 },
      { size: 120, left: 78, top: 44, depth: 15, opacity: 0.2 },
      { size: 260, left: 60, top: 52, depth: 7, opacity: 0.1 },
      { size: 110, left: 24, top: 62, depth: 14, opacity: 0.18 },
      { size: 190, left: -5, top: 74, depth: 9, opacity: 0.13 },
      { size: 80, left: 86, top: 76, depth: 18, opacity: 0.24 },
      { size: 150, left: 47, top: 82, depth: 13, opacity: 0.17 },
      { size: 105, left: 8, top: 88, depth: 19, opacity: 0.2 },
      { size: 170, left: 72, top: 90, depth: 10, opacity: 0.14 }
    ],
    []
  );

  const handleHeroMouseMove = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setHeroPointer({ x, y });
  }, []);

  const handleHeroMouseLeave = useCallback(() => {
    setHeroPointer({ x: 50, y: 50 });
  }, []);

  const targetPath = useMemo(() => {
    if (!user) return null;
    // Redirect to profile if first login to change password
    if (user.firstLogin) return '/profile';
    if (user.role === 'admin') return '/admin';
    if (user.role === 'driver') return '/driver';
    if (user.role === 'student') return '/student';
    return '/login';
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isSignUp) {
        // Register new student — no password needed, auto-set to roll number
        await api.post('/auth/register', {
          username,
          name,
          email
        });
        // Show success popup, switch to login mode
        setRegistrationSuccess(true);
        setName('');
        setEmail('');
        // Keep username so user can log in easily
        setPassword('');
      } else {
        await login({ username, password });
      }
    } catch (err) {
      console.error('Auth error:', err);
      const errorMsg = err.response?.data?.message
        || err.response?.data?.error
        || err.message
        || (isSignUp ? 'Registration failed' : 'Login failed');
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setRegistrationSuccess(false);
  };

  const openForgotPassword = () => {
    setShowForgotPassword(true);
    setForgotIdentifier('');
    setForgotResult(null);
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotIdentifier('');
    setForgotResult(null);
    setForgotLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) return;
    setForgotLoading(true);
    setForgotResult(null);

    try {
      const res = await api.post('/auth/forgot-password', { identifier: forgotIdentifier.trim() });
      setForgotResult({ type: 'success', message: res.data.message || 'Check your email for the password.' });
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong. Try again.';
      setForgotResult({ type: 'error', message: msg });
    } finally {
      setForgotLoading(false);
    }
  };

  if (targetPath) {
    return <Navigate to={targetPath} replace />;
  }

  return (
    <main className="login-page">
      {/* ===== LEFT PANEL — Visual Story ===== */}
      <div
        className="login-hero"
        onMouseMove={handleHeroMouseMove}
        onMouseLeave={handleHeroMouseLeave}
        style={{
          '--mouse-x': `${heroPointer.x}%`,
          '--mouse-y': `${heroPointer.y}%`
        }}
      >
        {/* Animated background shapes */}
        <div className="login-hero-bg">
          {heroCircles.map((circle, index) => (
            <span
              key={`${circle.size}-${index}`}
              className="hero-circle"
              style={{
                width: `${circle.size}px`,
                height: `${circle.size}px`,
                left: `${circle.left}%`,
                top: `${circle.top}%`,
                '--depth': circle.depth,
                '--opacity': circle.opacity
              }}
            />
          ))}
        </div>

        <div className="login-hero-content">
          {/* Logo
          <img
            src="/logohorigental.svg"
            alt="Raahi"
            className="login-hero-logo"
          /> */}

          {/* Tagline */}
          <h1 className="login-hero-title">
            {isSignUp ? 'Start Your Smart Commute Today' : 'Smart Bus Tracking Made Simple'}
          </h1>
          <p className="login-hero-subtitle">
            {isSignUp
              ? 'Join Raahi to track your bus in real time.'
              : 'Track. Ride. Arrive safely.'}
          </p>

          {/* Feature pills */}
          <div className="login-hero-features">
            <div className="hero-feature-pill">
              <MapPin className="w-4 h-4" />
              <span>Live Tracking</span>
            </div>
            <div className="hero-feature-pill">
              <Bell className="w-4 h-4" />
              <span>Smart Alerts</span>
            </div>
            <div className="hero-feature-pill">
              <Shield className="w-4 h-4" />
              <span>Secure Login</span>
            </div>
          </div>

          {/* Cursor-reactive bus illustration */}
          <div className="login-hero-illustration">
            <div
              className="hero-bus"
              style={{
                '--bus-x': `${(heroPointer.x - 50) * 0.32}px`,
                '--bus-y': `${(heroPointer.y - 50) * 0.18}px`
              }}
            >
              <BusFront className="w-7 h-7" />
            </div>
          </div>
        </div>
      </div>

      {/* ===== RIGHT PANEL — Auth Card ===== */}
      <div className="login-form-panel">
        <div className="login-card login-card-animate">
          {/* Mobile logo (hidden on desktop) */}
          <div className="login-card-mobile-logo">
            {/* <img src="/logohorigental.svg" alt="raahi" className="h-10" /> */}
          </div>

          {/* Card Header */}
          <div className="mb-7">
            <h2 className="login-card-title">
              {isSignUp ? 'Create Your Account' : 'Welcome Back'}
            </h2>
            <p className="login-card-subtitle">
              {isSignUp ? 'Get started with Raahi' : 'Log in to continue tracking your bus'}
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Registration Success */}
            {registrationSuccess && (
              <div className="login-success-banner login-card-animate">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-emerald-800 text-sm">Account Created Successfully!</h3>
                    <p className="text-xs text-emerald-600 mt-1 leading-relaxed">
                      Check your email for login credentials. Your initial password is your roll number.
                    </p>
                    <button
                      type="button"
                      onClick={() => { setRegistrationSuccess(false); setIsSignUp(false); }}
                      className="mt-3 text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors"
                    >
                      Go to Sign In &rarr;
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Full Name (signup only) */}
            {isSignUp && !registrationSuccess && (
              <div className="login-field">
                <label className="login-label">
                  Full Name <span className="text-blue-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  className="login-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Username / Roll Number */}
            {!registrationSuccess && (
              <div className="login-field">
                <label className="login-label">
                  {isSignUp ? 'Roll Number' : 'Roll Number / Username'} {isSignUp && <span className="text-blue-500">*</span>}
                </label>
                <input
                  type="text"
                  placeholder={isSignUp ? 'Enter your roll number' : 'Enter roll number or username'}
                  className="login-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Email (signup only) */}
            {isSignUp && !registrationSuccess && (
              <div className="login-field">
                <label className="login-label">
                  Email Address <span className="text-blue-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="your.email@example.com"
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={isLoading}
                />
                <p className="text-xs mt-1.5 login-hint">You'll receive a welcome email with your login details</p>
              </div>
            )}

            {/* Password (login only) */}
            {!isSignUp && !registrationSuccess && (
              <div className="login-field">
                <label className="login-label">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className="login-input pr-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={openForgotPassword}
                    className="text-xs font-medium text-blue-400 hover:text-blue-600 transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="login-error login-card-animate">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            {!registrationSuccess && (
              <button
                type="submit"
                disabled={isLoading}
                className="login-btn-primary"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isSignUp ? 'Creating account...' : 'Signing in...'}
                  </>
                ) : (
                  <>
                    {isSignUp ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                    {isSignUp ? 'Create Account' : 'Log In'}
                  </>
                )}
              </button>
            )}
          </form>

          {/* Toggle Sign up / Sign in */}
          <div className="login-toggle-section">
            <p className="login-toggle-text">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              <button
                type="button"
                onClick={toggleMode}
                className="login-toggle-btn"
              >
                {isSignUp ? 'Sign In' : 'Create Account'}
              </button>
            </p>
          </div>

          {/* Footer hint */}
          <p className="login-footer-hint">
            {isSignUp
              ? 'Student accounts only. Admin/Driver accounts are created by administrators.'
              : 'Contact your administrator if you need help'}
          </p>
        </div>
      </div>

      {/* ===== Forgot Password Modal ===== */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={closeForgotPassword}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="login-modal login-card-animate"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              type="button"
              onClick={closeForgotPassword}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Forgot Password</h3>
                <p className="text-xs text-gray-500">We&apos;ll reset and email your credentials</p>
              </div>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="login-field">
                <label className="login-label">Roll Number or Email</label>
                <input
                  type="text"
                  placeholder="Enter your roll number or email"
                  className="login-input"
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  required
                  autoFocus
                  disabled={forgotLoading}
                />
              </div>

              {/* Result */}
              {forgotResult && (
                <div
                  className={`login-card-animate rounded-xl px-4 py-3 text-sm flex items-start gap-2 ${
                    forgotResult.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                      : 'bg-red-50 border border-red-200 text-red-600'
                  }`}
                >
                  {forgotResult.type === 'success'
                    ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    : <X className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  }
                  <span>{forgotResult.message}</span>
                </div>
              )}

              {forgotResult?.type === 'success' ? (
                <button
                  type="button"
                  onClick={closeForgotPassword}
                  className="w-full rounded-xl bg-gray-100 py-3 text-gray-700 font-semibold hover:bg-gray-200 transition-all active:scale-[0.98]"
                >
                  Back to Login
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={forgotLoading || !forgotIdentifier.trim()}
                  className="login-btn-primary"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default Login;

