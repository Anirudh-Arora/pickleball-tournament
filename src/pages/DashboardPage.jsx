import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getOrganizerTournaments } from '../utils/firestore';
import { formatStatus, statusBadgeClass } from '../utils/drawEngine';

export default function DashboardPage() {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    getOrganizerTournaments(user.uid)
      .then(t => { setTournaments(t); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <h1 style={{ marginBottom: '0.25rem' }}>My Tournaments</h1>
            <p>Manage your pickleball tournaments</p>
          </div>
          <Link to="/tournament/new" className="btn btn-primary btn-lg no-print">
            + Create Tournament
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="loading-page">
          <div className="spinner" aria-label="Loading tournaments" />
          <p>Loading your tournaments…</p>
        </div>
      ) : tournaments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏓</div>
          <h3>No tournaments yet</h3>
          <p>Create your first tournament and start organizing. Share a link for players to register.</p>
          <Link to="/tournament/new" className="btn btn-primary">Create Your First Tournament</Link>
        </div>
      ) : (
        <div className="tournament-grid">
          {tournaments.map(t => (
            <div
              key={t.id}
              className="tournament-card"
              onClick={() => navigate(`/organizer/${t.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && navigate(`/organizer/${t.id}`)}
              aria-label={`Open ${t.name}`}
            >
              <div className="tournament-card-header">
                <div className="d-flex justify-between align-center" style={{ width: '100%' }}>
                  <div>
                    <h3>{t.name}</h3>
                    <div className="meta">📍 {t.location || 'Location TBD'}</div>
                  </div>
                  <span className={`badge ${statusBadgeClass(t.status)}`}>{formatStatus(t.status)}</span>
                </div>
              </div>
              <div className="card-body">
                <div className="tournament-meta-row">
                  📅 {t.eventDate || 'Date TBD'}
                </div>
                <div className="tournament-meta-row">
                  🎮 {t.format?.replace(/_/g, ' ')?.replace(/\b\w/g, l => l.toUpperCase()) || 'Format TBD'}
                </div>
                <div className="tournament-meta-row">
                  👥 {t.participantCount || 0} registered{t.maxParticipants ? ` / ${t.maxParticipants} max` : ''}
                </div>
                <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Created {formatDate(t.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
