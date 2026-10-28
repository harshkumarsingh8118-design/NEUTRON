import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { NeutronLogo } from './NeutronLogo';
import { LuminousOrb } from './LuminousOrb';
import { api } from '../services/api';
import type { AuthUser } from '../types';

interface AuthPageProps {
  onAuthenticated: (user: AuthUser) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  
  // Sign In State
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showSignInPass, setShowSignInPass] = useState(false);

  // Sign Up State
  const [name, setName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('AI Engineer');
  const [showSignUpPass, setShowSignUpPass] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);

  // Feedback State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const roles = [
    { id: 'AI Engineer', label: 'AI Engineer' },
    { id: 'Fullstack Dev', label: 'Fullstack Dev' },
    { id: 'DevOps & SRE', label: 'DevOps / SRE' },
    { id: 'ML Researcher', label: 'ML Researcher' },
  ];

  // Helper for password strength
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'transparent' };
    if (pass.length < 6) return { score: 1, label: 'Weak', color: '#ef4444' };
    if (pass.length < 10) return { score: 2, label: 'Moderate', color: '#f59e0b' };
    return { score: 3, label: 'Strong', color: '#10b981' };
  };

  const strength = getPasswordStrength(signUpPassword);

  const handleFillDemo = () => {
    setSignInEmail('demo@neutron.ai');
    setSignInPassword('password123');
    setErrorMsg(null);
  };

  const handleSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!signInEmail.trim() || !signInPassword.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.login({
        email: signInEmail.trim(),
        password: signInPassword,
      });
      setSuccessMsg(`Welcome back, ${res.user.name}!`);
      setTimeout(() => {
        onAuthenticated(res.user);
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!signUpEmail.trim() || !signUpEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (signUpPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (signUpPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (!agreeTerms) {
      setErrorMsg('Please accept developer terms to proceed.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.register({
        name: name.trim(),
        email: signUpEmail.trim(),
        password: signUpPassword,
        role,
      });
      setSuccessMsg(`Account created successfully! Welcome, ${res.user.name}.`);
      setTimeout(() => {
        onAuthenticated(res.user);
      }, 600);
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestAccess = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.guestLogin();
      setSuccessMsg('Initialized Guest Sandbox Session!');
      setTimeout(() => {
        onAuthenticated(res.user);
      }, 400);
    } catch (err: any) {
      // Fallback guest user if server is unavailable
      const fallbackUser: AuthUser = {
        id: `guest_${Date.now()}`,
        name: 'Guest Developer',
        email: 'guest@neutron.local',
        role: 'Autonomous AI Explorer',
        avatarColor: 'linear-gradient(135deg, #ff6644 0%, #ff8554 100%)',
        createdAt: Date.now(),
      };
      onAuthenticated(fallbackUser);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = (providerName: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    setTimeout(() => {
      const oauthUser: AuthUser = {
        id: `usr_oauth_${providerName.toLowerCase()}_${Date.now()}`,
        name: `${providerName} Developer`,
        email: `dev@${providerName.toLowerCase()}.user`,
        role: 'Senior AI Engineer',
        avatarColor: providerName === 'GitHub' 
          ? 'linear-gradient(135deg, #24292e 0%, #404448 100%)' 
          : 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
        createdAt: Date.now(),
      };
      setSuccessMsg(`Authenticated via ${providerName}!`);
      setTimeout(() => {
        onAuthenticated(oauthUser);
      }, 400);
    }, 600);
  };

  return (
    <div className="auth-root-wrapper">
      {/* Dynamic Background Elements */}
      <div className="auth-bg-ambient-orb auth-orb-1" />
      <div className="auth-bg-ambient-orb auth-orb-2" />
      <div className="auth-bg-ambient-orb auth-orb-3" />
      <div className="auth-bg-grid" />

      {/* Main Glassmorphic Container */}
      <div className="auth-card-container">
        
        {/* Left Side: Brand Showcase & Features */}
        <div className="auth-brand-pane">
          <div className="auth-brand-hero">
            <div className="auth-brand-logo-badge">
              <NeutronLogo size={32} withText withTagline />
            </div>

            <div className="auth-orb-showcase">
              <LuminousOrb size={88} />
            </div>

            <h1 className="auth-brand-title">
              Intelligence <span className="auth-text-gradient">in Action.</span>
            </h1>
            <p className="auth-brand-desc">
              Experience the next generation of autonomous software engineering. Plan, build, inspect, and execute safely within your local environment.
            </p>

            <div className="auth-features-list">
              <div className="auth-feature-row">
                <div className="auth-feature-icon-box">
                  <Zap size={16} />
                </div>
                <div>
                  <h4 className="auth-feature-heading">Autonomous Agent Workflow</h4>
                  <p className="auth-feature-sub">Multi-step planning, file modification, and iterative debugging</p>
                </div>
              </div>

              <div className="auth-feature-row">
                <div className="auth-feature-icon-box">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h4 className="auth-feature-heading">Zero-Leakage Sandbox</h4>
                  <p className="auth-feature-sub">Proactive command security guard and diff approval controls</p>
                </div>
              </div>

              <div className="auth-feature-row">
                <div className="auth-feature-icon-box">
                  <Cpu size={16} />
                </div>
                <div>
                  <h4 className="auth-feature-heading">Multi-Model Agility</h4>
                  <p className="auth-feature-sub">Seamless toggle across Gemini 2.5, Claude 3.7, and GPT-4o</p>
                </div>
              </div>
            </div>

            {/* Sandbox Status Live Pill */}
            <div className="auth-status-pill">
              <span className="auth-status-dot" />
              <span>Sandbox Engine Online</span>
              <span className="auth-status-port">Port 3001</span>
            </div>
          </div>
        </div>

        {/* Right Side: Sign In / Sign Up Form */}
        <div className="auth-form-pane">
          
          {/* Top Mode Segmented Switcher */}
          <div className="auth-nav-tabs">
            <button
              type="button"
              className={`auth-nav-tab ${mode === 'signin' ? 'active' : ''}`}
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-nav-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
            >
              Create Account
            </button>
          </div>

          {/* Instant Guest / Demo Workspace Banner */}
          <div className="auth-guest-banner" onClick={handleGuestAccess}>
            <div className="auth-guest-content">
              <div className="auth-guest-badge">
                <Sparkles size={14} /> Quick Start
              </div>
              <div>
                <div className="auth-guest-title">Explore Demo Workspace</div>
                <div className="auth-guest-desc">Jump straight in as a guest without creating an account</div>
              </div>
            </div>
            <ArrowRight size={16} className="auth-guest-arrow" />
          </div>

          {/* Social Quick Sign-In */}
          <div className="auth-social-row">
            <button
              type="button"
              className="auth-social-btn"
              onClick={() => handleOAuthLogin('GitHub')}
              title="Continue with GitHub"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>GitHub</span>
            </button>

            <button
              type="button"
              className="auth-social-btn"
              onClick={() => handleOAuthLogin('Google')}
              title="Continue with Google"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Google</span>
            </button>
          </div>

          <div className="auth-divider">
            <span>or continue with email</span>
          </div>

          {/* Feedback Banners */}
          {errorMsg && (
            <div className="auth-alert error">
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="auth-alert success">
              <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* FORM: SIGN IN */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="auth-form-body">
              <div className="auth-input-group">
                <label className="auth-label">Email Address</label>
                <div className="auth-input-wrapper">
                  <Mail size={16} className="auth-input-icon" />
                  <input
                    type="email"
                    className="auth-input"
                    placeholder="name@company.com"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <div className="auth-label-row">
                  <label className="auth-label">Password</label>
                  <button
                    type="button"
                    className="auth-forgot-btn"
                    onClick={() => {
                      setErrorMsg(null);
                      setSuccessMsg('Tip: Default demo password is "password123" for demo@neutron.ai');
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="auth-input-wrapper">
                  <Lock size={16} className="auth-input-icon" />
                  <input
                    type={showSignInPass ? 'text' : 'password'}
                    className="auth-input"
                    placeholder="Enter your password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="auth-eye-btn"
                    onClick={() => setShowSignInPass(!showSignInPass)}
                    tabIndex={-1}
                  >
                    {showSignInPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="auth-checkbox-row">
                <label className="auth-checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me on this workstation</span>
                </label>
              </div>

              {/* Demo Account Quick-Fill Chip */}
              <div className="auth-demo-chip" onClick={handleFillDemo} title="Click to prefill demo credentials">
                <span>⚡ Use test account: <strong>demo@neutron.ai</strong></span>
              </div>

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="auth-spinner" />
                ) : (
                  <>
                    <span>Sign In to NEUTRON</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* FORM: SIGN UP */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="auth-form-body">
              <div className="auth-input-group">
                <label className="auth-label">Full Name</label>
                <div className="auth-input-wrapper">
                  <UserIcon size={16} className="auth-input-icon" />
                  <input
                    type="text"
                    className="auth-input"
                    placeholder="e.g. Alex Mercer"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <label className="auth-label">Work Email</label>
                <div className="auth-input-wrapper">
                  <Mail size={16} className="auth-input-icon" />
                  <input
                    type="email"
                    className="auth-input"
                    placeholder="alex@neutron.ai"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Developer Role Pill Selector */}
              <div className="auth-input-group">
                <label className="auth-label">Primary Role</label>
                <div className="auth-roles-grid">
                  {roles.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={`auth-role-pill ${role === r.id ? 'active' : ''}`}
                      onClick={() => setRole(r.id)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="auth-input-group">
                <label className="auth-label">Password</label>
                <div className="auth-input-wrapper">
                  <Lock size={16} className="auth-input-icon" />
                  <input
                    type={showSignUpPass ? 'text' : 'password'}
                    className="auth-input"
                    placeholder="Minimum 6 characters"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="auth-eye-btn"
                    onClick={() => setShowSignUpPass(!showSignUpPass)}
                    tabIndex={-1}
                  >
                    {showSignUpPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Password Strength Indicator */}
                {signUpPassword && (
                  <div className="auth-strength-meter">
                    <div className="auth-strength-bars">
                      <div className={`bar ${strength.score >= 1 ? 'filled' : ''}`} style={{ background: strength.color }} />
                      <div className={`bar ${strength.score >= 2 ? 'filled' : ''}`} style={{ background: strength.color }} />
                      <div className={`bar ${strength.score >= 3 ? 'filled' : ''}`} style={{ background: strength.color }} />
                    </div>
                    <span className="auth-strength-text" style={{ color: strength.color }}>
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              <div className="auth-input-group">
                <label className="auth-label">Confirm Password</label>
                <div className="auth-input-wrapper">
                  <Lock size={16} className="auth-input-icon" />
                  <input
                    type="password"
                    className="auth-input"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  {confirmPassword && signUpPassword === confirmPassword && (
                    <CheckCircle2 size={16} className="auth-input-check" />
                  )}
                </div>
              </div>

              <div className="auth-checkbox-row">
                <label className="auth-checkbox-label">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                  />
                  <span>I accept the Developer Sandbox terms and local privacy guidelines</span>
                </label>
              </div>

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="auth-spinner" />
                ) : (
                  <>
                    <span>Create NEUTRON Account</span>
                    <Sparkles size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Footer Note */}
          <div className="auth-footer-text">
            <span>Secured with local cryptographic salt & sandboxed control.</span>
          </div>

        </div>
      </div>
    </div>
  );
};
