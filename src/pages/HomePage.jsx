import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <>
      <div className="hero">
        <div className="hero-content">
          <h1>Run <span>Pickleball</span> Tournaments<br />Like a Pro</h1>
          <p>Create tournaments, manage registrations, generate draws, and track results — all in one place. Free for organizers, effortless for players.</p>
          <div className="hero-actions">
            {user ? (
              <Link to="/dashboard" className="btn btn-accent btn-lg">
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn btn-accent btn-lg">
                  Start Organizing Free
                </Link>
                <Link to="/login" className="btn btn-outline btn-lg" style={{ color: 'rgba(255,255,255,0.9)', borderColor: 'rgba(255,255,255,0.4)' }}>
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="container" style={{ padding: '4rem 1.25rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2>Everything you need to run great tournaments</h2>
          <p style={{ fontSize: '1.1rem', maxWidth: '560px', margin: '0.75rem auto 0' }}>
            From registration to final standings — PickleHQ handles the complexity so you can focus on the game.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '4rem' }}>
          {[
            { icon: '🎯', title: 'Smart Draw Generation', desc: 'Round robin, single & double elimination, mixed doubles. Auto-balanced by skill level.' },
            { icon: '📱', title: 'Mobile-First Design', desc: 'Participants register and check schedules on their phones, right at the venue.' },
            { icon: '🔗', title: 'Shareable Links', desc: 'One unique link per tournament. Share it and participants register instantly.' },
            { icon: '📊', title: 'Live Standings', desc: 'Enter scores and watch the standings table update in real time.' },
            { icon: '🏆', title: '6 Tournament Formats', desc: 'Mixed doubles, open doubles, round robin, team reg, single & double elimination.' },
            { icon: '⚖️', title: 'Skill Balancing', desc: 'Automatic pairing algorithms that create fair, competitive matchups.' },
          ].map((f, i) => (
            <div key={i} className="card">
              <div className="card-body">
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{f.icon}</div>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.375rem' }}>{f.title}</h3>
                <p style={{ fontSize: '0.875rem' }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: 'linear-gradient(135deg, var(--court-green-dark), var(--court-green))', borderRadius: 'var(--radius-xl)', padding: '3rem', textAlign: 'center' }}>
          <h2 style={{ color: 'white', marginBottom: '0.75rem' }}>Ready to run your next tournament?</h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '1.5rem' }}>Free to use. No credit card required.</p>
          <Link to={user ? '/dashboard' : '/register'} className="btn btn-accent btn-lg">
            {user ? 'Go to Dashboard' : 'Create Your First Tournament →'}
          </Link>
        </div>
      </div>
    </>
  );
}
