import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function AuthForm({ mode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const { login, register, resetPassword } = useAuth();
  const navigate = useNavigate();

  const isLogin = mode === 'login';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isLogin && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password);
      }
      navigate('/dashboard');
    } catch (err) {
      const messages = {
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'auth/invalid-credential': 'Invalid email or password.',
      };
      setError(messages[err.code] || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) { setError('Enter your email address above first.'); return; }
    try {
      await resetPassword(email);
      setResetSent(true);
      setError('');
    } catch {
      setError('Could not send reset email. Check the address and try again.');
    }
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', padding: '2rem 1.25rem' }}>
      <div className="container-sm" style={{ width: '100%' }}>
        <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
          <div className="card-body" style={{ padding: '2.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏓</div>
              <h2 style={{ marginBottom: '0.25rem' }}>
                {isLogin ? 'Welcome back' : 'Create your account'}
              </h2>
              <p style={{ fontSize: '0.875rem' }}>
                {isLogin ? "Sign in to manage your tournaments" : "Start organizing pickleball tournaments for free"}
              </p>
            </div>

            {error && (
              <div className="alert alert-danger mb-3" role="alert">
                <span className="alert-icon" aria-hidden="true">⚠️</span>
                <span>{error}</span>
              </div>
            )}
            {resetSent && (
              <div className="alert alert-success mb-3" role="alert">
                <span className="alert-icon" aria-hidden="true">✅</span>
                <span>Password reset email sent! Check your inbox.</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email address <span className="required" aria-hidden="true">*</span></label>
                <input
                  id="email"
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Password <span className="required" aria-hidden="true">*</span></label>
                <input
                  id="password"
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  minLength={6}
                />
              </div>

              {!isLogin && (
                <div className="form-group">
                  <label className="form-label" htmlFor="confirm">Confirm Password <span className="required" aria-hidden="true">*</span></label>
                  <input
                    id="confirm"
                    type="password"
                    className="form-control"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                  />
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-full btn-lg mt-2" disabled={loading}>
                {loading ? 'Please wait…' : isLogin ? 'Sign In' : 'Create Account'}
              </button>

              {isLogin && (
                <button type="button" onClick={handleReset} className="btn btn-ghost btn-full mt-1" style={{ fontSize: '0.82rem' }}>
                  Forgot password?
                </button>
              )}
            </form>

            <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {isLogin ? (
                <>Don't have an account? <Link to="/register">Sign up free</Link></>
              ) : (
                <>Already have an account? <Link to="/login">Sign in</Link></>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoginPage() { return <AuthForm mode="login" />; }
export function RegisterPage() { return <AuthForm mode="register" />; }
