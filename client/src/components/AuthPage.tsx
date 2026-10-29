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
  onAuthenticated: (user: AuthUser, token: string, remember: boolean) => void;
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
        onAuthenticated(res.user, res.token, rememberMe);
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
        onAuthenticated(res.user, res.token, true);
      }, 600);
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
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
                  <h4 className="auth-feature-heading">NVIDIA Nemotron Intelligence</h4>
                  <p className="auth-feature-sub">Powered exclusively by NVIDIA Nemotron reasoning through NIM</p>
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
