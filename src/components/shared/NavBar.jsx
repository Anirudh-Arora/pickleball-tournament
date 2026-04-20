import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="topnav" role="navigation" aria-label="Main navigation">
      <div className="topnav-inner">
        <Link to="/" className="topnav-brand" aria-label="PickleHQ Home">
          <div className="topnav-brand-icon" aria-hidden="true">🏓</div>
          <span className="topnav-brand-text">Pickle<span>HQ</span></span>
        </Link>

        <div className="topnav-actions">
          {user ? (
            <>
              <span className="topnav-user d-flex align-center gap-1 no-print">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {user.email?.split('@')[0]}
              </span>
              <Link to="/dashboard" className="btn btn-ghost btn-sm no-print">
                Dashboard
              </Link>
              <button onClick={handleLogout} className="btn btn-outline btn-sm no-print" aria-label="Sign out">
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm no-print">Sign In</Link>
              <Link to="/register" className="btn btn-accent btn-sm no-print">Get Started</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
