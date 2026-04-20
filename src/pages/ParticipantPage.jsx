import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getTournamentBySlug, getParticipants, registerParticipant, getTeams, getMatches, updateTournament } from '../utils/firestore';
import { formatStatus, statusBadgeClass, getFormatById, SKILL_LEVELS, getRoundName, calculateStandings } from '../utils/drawEngine';

export default function ParticipantPage() {
  const { slug } = useParams();
  const [tournament, setTournament] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('info');
  const [regSuccess, setRegSuccess] = useState(false);
  const [error, setError] = useState('');

  // Registration form
  const [form, setForm] = useState({ name: '', email: '', phone: '', gender: '', skillLevel: '', partnerName: '' });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const t = await getTournamentBySlug(slug);
        if (!t) { setError('Tournament not found.'); setLoading(false); return; }
        const [p, tm, m] = await Promise.all([
          getParticipants(t.id),
          getTeams(t.id),
          getMatches(t.id),
        ]);
        setTournament(t);
        setParticipants(p);
        setTeams(tm);
        setMatches(m);
      } catch {
        setError('Failed to load tournament.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) return <div className="loading-page"><div className="spinner" /><p>Loading tournament…</p></div>;
  if (error && !tournament) return (
    <div className="container-sm" style={{ paddingTop: '4rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
      <h2>Tournament not found</h2>
      <p>{error}</p>
    </div>
  );

  const fmt = getFormatById(tournament?.format);
  const now = new Date();
  const regOpen = tournament.registrationOpen ? new Date(tournament.registrationOpen) : null;
  const regClose = tournament.registrationClose ? new Date(tournament.registrationClose) : null;
  const registeredCount = participants.filter(p => p.status === 'registered').length;
  const isFull = tournament.maxParticipants && registeredCount >= tournament.maxParticipants;
  const regActive = tournament.status === 'open'
    && (!regOpen || now >= regOpen)
    && (!regClose || now <= regClose)
    && !isFull;
  const isWaitlistOpen = tournament.status === 'open' && isFull;
  const hasDrawn = ['draw_generated', 'in_progress', 'completed'].includes(tournament.status);

  const isTeamFormat = ['mixed_doubles_random', 'open_doubles_random'].includes(tournament.format);
  const entrants = isTeamFormat && teams.length > 0 ? teams : participants.filter(p => p.status === 'registered');
  const isElim = ['single_elimination', 'double_elimination'].includes(tournament.format);
  const standings = !isElim && matches.length > 0 ? calculateStandings(entrants, matches) : [];

  const groupedMatches = matches.reduce((acc, m) => {
    if (!acc[m.roundIndex]) acc[m.roundIndex] = [];
    acc[m.roundIndex].push(m);
    return acc;
  }, {});
  const totalRounds = Object.keys(groupedMatches).length;

  const updateForm = (k, v) => { setForm(p => ({ ...p, [k]: v })); setFormErrors(p => ({ ...p, [k]: '' })); };

  const validateForm = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required.';
    if (fmt?.requiresGender || tournament.collectGender) {
      if (!form.gender) e.gender = 'Gender is required for this format.';
    }
    if (tournament.requiresSkillLevel && tournament.skillLevelAssignment === 'self') {
      if (!form.skillLevel) e.skillLevel = 'Skill level is required.';
    }
    if (fmt?.requiresTeamReg && !form.partnerName.trim()) e.partnerName = "Partner's name is required.";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSubmitting(true);
    setError('');
    try {
      const status = isWaitlistOpen ? 'waitlisted' : 'registered';
      await registerParticipant(tournament.id, {
        ...form,
        name: form.name.trim(),
        email: form.email.toLowerCase().trim(),
        skillLevel: form.skillLevel ? parseFloat(form.skillLevel) : null,
        status,
      });
      // Update participant count in tournament doc
      if (status === 'registered') {
        await updateTournament(tournament.id, { participantCount: registeredCount + 1 });
      } else {
        await updateTournament(tournament.id, { waitlistCount: (tournament.waitlistCount || 0) + 1 });
      }
      setRegSuccess(true);
      setForm({ name: '', email: '', phone: '', gender: '', skillLevel: '', partnerName: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Tournament Hero Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--shadow-dark) 0%, var(--court-green-dark) 70%)',
        padding: '2.5rem 1.25rem 2rem',
        color: 'white'
      }}>
        <div className="container-md">
          <div className="d-flex align-center gap-2 mb-2">
            <span className={`badge ${statusBadgeClass(tournament.status)}`}>{formatStatus(tournament.status)}</span>
            {hasDrawn && <span className="badge badge-active">Draw Ready</span>}
            {isFull && tournament.status === 'open' && <span className="badge badge-waitlist">Waitlist Open</span>}
          </div>
          <h1 style={{ color: 'white', marginBottom: '0.5rem' }}>{tournament.name}</h1>
          <div style={{ color: 'rgba(255,255,255,0.75)', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.9rem' }}>
            <span>📍 {tournament.location}</span>
            <span>📅 {tournament.eventDate}{tournament.endDate ? ` – ${tournament.endDate}` : ''}</span>
            <span>🎮 {fmt?.label || tournament.format}</span>
            <span>🏟 {tournament.courts} court{tournament.courts !== 1 ? 's' : ''}</span>
            <span>👥 {registeredCount}{tournament.maxParticipants ? `/${tournament.maxParticipants}` : ''} registered</span>
          </div>
        </div>
      </div>

      <div className="container-md" style={{ paddingTop: '1.5rem', paddingBottom: '4rem' }}>
        {/* Tabs */}
        <div className="tabs">
          <button className={`tab-btn ${tab === 'info' ? 'active' : ''}`} onClick={() => setTab('info')}>Info & Register</button>
          {tournament.showParticipantList && <button className={`tab-btn ${tab === 'players' ? 'active' : ''}`} onClick={() => setTab('players')}>Players ({registeredCount})</button>}
          {hasDrawn && <button className={`tab-btn ${tab === 'schedule' ? 'active' : ''}`} onClick={() => setTab('schedule')}>Schedule</button>}
          {hasDrawn && standings.length > 0 && <button className={`tab-btn ${tab === 'standings' ? 'active' : ''}`} onClick={() => setTab('standings')}>Standings</button>}
          {tournament.status === 'completed' && <button className={`tab-btn ${tab === 'results' ? 'active' : ''}`} onClick={() => setTab('results')}>Results</button>}
        </div>

        {/* ── Info & Register ── */}
        {tab === 'info' && (
          <div>
            {tournament.description && (
              <div className="card mb-3">
                <div className="card-body">
                  <h3 style={{ marginBottom: '0.625rem' }}>About this Tournament</h3>
                  <p>{tournament.description}</p>
                </div>
              </div>
            )}

            {/* Registration */}
            {regSuccess ? (
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: '2.5rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                  <h2>You're registered!</h2>
                  <p style={{ marginTop: '0.5rem' }}>
                    {isWaitlistOpen
                      ? "You've been added to the waitlist. We'll notify you if a spot opens up."
                      : `You've successfully registered for ${tournament.name}. See you on the court!`
                    }
                  </p>
                  <button onClick={() => setRegSuccess(false)} className="btn btn-outline mt-3">Register Another Player</button>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="card-header">
                  <h3>
                    {regActive ? '📝 Register' : isWaitlistOpen ? '⏳ Join Waitlist' : '🔒 Registration'}
                  </h3>
                  {tournament.registrationClose && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Closes {new Date(tournament.registrationClose).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="card-body">
                  {!regActive && !isWaitlistOpen ? (
                    <div className="alert alert-warning">
                      <span className="alert-icon">🔒</span>
                      <span>
                        {tournament.status === 'draft' ? 'Registration has not opened yet.' :
                         tournament.status === 'closed' || tournament.status === 'draw_generated' ? 'Registration is closed.' :
                         now < regOpen ? `Registration opens ${regOpen.toLocaleDateString()}.` :
                         now > regClose ? 'Registration has closed.' :
                         'Registration is not currently available.'}
                      </span>
                    </div>
                  ) : (
                    <>
                      {isWaitlistOpen && (
                        <div className="alert alert-warning mb-3">
                          <span className="alert-icon">⏳</span>
                          <span>The tournament is full. You'll be added to the waitlist.</span>
                        </div>
                      )}
                      {error && <div className="alert alert-danger mb-3"><span className="alert-icon">⚠️</span><span>{error}</span></div>}

                      <form onSubmit={handleRegister} noValidate>
                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label" htmlFor="reg-name">Full Name <span className="required">*</span></label>
                            <input id="reg-name" className={`form-control ${formErrors.name ? 'error' : ''}`} value={form.name} onChange={e => updateForm('name', e.target.value)} placeholder="Jane Smith" autoComplete="name" />
                            {formErrors.name && <span className="form-error">{formErrors.name}</span>}
                          </div>
                          <div className="form-group">
                            <label className="form-label" htmlFor="reg-email">Email <span className="required">*</span></label>
                            <input id="reg-email" type="email" className={`form-control ${formErrors.email ? 'error' : ''}`} value={form.email} onChange={e => updateForm('email', e.target.value)} placeholder="you@example.com" autoComplete="email" />
                            {formErrors.email && <span className="form-error">{formErrors.email}</span>}
                          </div>
                        </div>

                        {tournament.collectPhone && (
                          <div className="form-group">
                            <label className="form-label" htmlFor="reg-phone">Phone</label>
                            <input id="reg-phone" type="tel" className="form-control" value={form.phone} onChange={e => updateForm('phone', e.target.value)} placeholder="+1 555 000 0000" autoComplete="tel" />
                          </div>
                        )}

                        {(fmt?.requiresGender || tournament.collectGender) && (
                          <div className="form-group">
                            <label className="form-label" htmlFor="reg-gender">Gender <span className="required">*</span></label>
                            <select id="reg-gender" className={`form-control ${formErrors.gender ? 'error' : ''}`} value={form.gender} onChange={e => updateForm('gender', e.target.value)}>
                              <option value="">Select…</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                              <option value="other">Other / Prefer not to say</option>
                            </select>
                            {formErrors.gender && <span className="form-error">{formErrors.gender}</span>}
                          </div>
                        )}

                        {tournament.requiresSkillLevel && tournament.skillLevelAssignment === 'self' && (
                          <div className="form-group">
                            <label className="form-label" htmlFor="reg-skill">Skill Level <span className="required">*</span></label>
                            <select id="reg-skill" className={`form-control ${formErrors.skillLevel ? 'error' : ''}`} value={form.skillLevel} onChange={e => updateForm('skillLevel', e.target.value)}>
                              <option value="">Select your rating…</option>
                              {SKILL_LEVELS.map(l => <option key={l} value={l}>{l} {l <= 2.5 ? '(Beginner)' : l <= 3.5 ? '(Intermediate)' : l <= 4.5 ? '(Advanced)' : '(Professional)'}</option>)}
                            </select>
                            {formErrors.skillLevel && <span className="form-error">{formErrors.skillLevel}</span>}
                            <span className="form-hint">Be honest — this helps us create balanced matchups!</span>
                          </div>
                        )}

                        {fmt?.requiresTeamReg && (
                          <div className="form-group">
                            <label className="form-label" htmlFor="reg-partner">Partner's Full Name <span className="required">*</span></label>
                            <input id="reg-partner" className={`form-control ${formErrors.partnerName ? 'error' : ''}`} value={form.partnerName} onChange={e => updateForm('partnerName', e.target.value)} placeholder="Your partner's name" />
                            {formErrors.partnerName && <span className="form-error">{formErrors.partnerName}</span>}
                            <span className="form-hint">Both team members must use the same partner name.</span>
                          </div>
                        )}

                        <button type="submit" className="btn btn-primary btn-full btn-lg mt-2" disabled={submitting}>
                          {submitting ? 'Registering…' : isWaitlistOpen ? 'Join Waitlist' : 'Register Now'}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Players List ── */}
        {tab === 'players' && tournament.showParticipantList && (
          <div>
            <h2 style={{ marginBottom: '1rem' }}>Registered Players ({registeredCount})</h2>
            {registeredCount === 0 ? (
              <div className="empty-state"><div className="empty-state-icon">👥</div><h3>No players yet</h3><p>Be the first to register!</p></div>
            ) : (
              <div className="participant-list">
                {participants.filter(p => p.status === 'registered').map((p, i) => (
                  <div key={p.id} className="participant-item">
                    <div className="participant-avatar" aria-hidden="true">{p.name?.[0]?.toUpperCase() || '?'}</div>
                    <div className="participant-info">
                      <div className="participant-name">{p.name}</div>
                      <div className="participant-meta">
                        {p.skillLevel && `Rating: ${p.skillLevel}`}
                        {p.skillLevel && p.gender && ' · '}
                        {p.gender === 'male' || p.gender === 'M' ? '♂' : p.gender === 'female' || p.gender === 'F' ? '♀' : ''}
                      </div>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>#{i + 1}</span>
                  </div>
                ))}
              </div>
            )}

            {participants.filter(p => p.status === 'waitlisted').length > 0 && (
              <>
                <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Waitlist ({participants.filter(p => p.status === 'waitlisted').length})</h3>
                <div className="participant-list">
                  {participants.filter(p => p.status === 'waitlisted').map((p, i) => (
                    <div key={p.id} className="participant-item">
                      <div className="participant-avatar" style={{ background: 'var(--net-gray)' }} aria-hidden="true">{p.name?.[0]?.toUpperCase()}</div>
                      <div className="participant-info">
                        <div className="participant-name">{p.name}</div>
                        <div className="participant-meta">Waitlisted</div>
                      </div>
                      <span className="badge badge-waitlist">#{i + 1}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Schedule ── */}
        {tab === 'schedule' && hasDrawn && (
          <div>
            <div className="d-flex justify-between align-center mb-3">
              <h2 style={{ margin: 0 }}>Match Schedule</h2>
              <button onClick={() => window.print()} className="btn btn-ghost btn-sm no-print">🖨 Print</button>
            </div>
            {matches.length === 0 ? (
              <div className="empty-state"><div className="empty-state-icon">📅</div><h3>Schedule coming soon</h3></div>
            ) : (
              Object.entries(groupedMatches).map(([roundIdx, roundMatches]) => (
                <div key={roundIdx} className="schedule-round">
                  <div className="schedule-round-header">
                    <span>⏱</span>
                    <span>{isElim ? getRoundName(parseInt(roundIdx), totalRounds) : `Round ${parseInt(roundIdx) + 1}`}</span>
                  </div>
                  {roundMatches.filter(m => !m.isBye).map(match => (
                    <div key={match.id} className="match-row">
                      <span className="match-court">Court {match.court}</span>
                      <span className="match-player" style={{ fontWeight: match.winner === match.player1Id ? 700 : 400 }}>{match.player1Name || 'TBD'}</span>
                      <span className="match-vs">vs</span>
                      <span className="match-player" style={{ fontWeight: match.winner === match.player2Id ? 700 : 400 }}>{match.player2Name || 'TBD'}</span>
                      <span style={{ fontSize: '0.82rem', color: match.winner ? 'var(--success)' : 'var(--text-muted)', fontWeight: match.winner ? 600 : 400 }}>
                        {match.winner ? `${match.score1}–${match.score2}` : match.time}
                      </span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Standings ── */}
        {tab === 'standings' && standings.length > 0 && (
          <div>
            <h2 style={{ marginBottom: '1.5rem' }}>Standings</h2>
            <div className="table-wrapper">
              <table className="standings-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player / Team</th>
                    <th>W</th>
                    <th>L</th>
                    <th>PF</th>
                    <th>PA</th>
                    <th>+/-</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 700 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{s.name}</td>
                      <td style={{ color: 'var(--success)', fontWeight: 700 }}>{s.wins}</td>
                      <td style={{ color: 'var(--danger)' }}>{s.losses}</td>
                      <td>{s.pointsFor}</td>
                      <td>{s.pointsAgainst}</td>
                      <td style={{ fontWeight: 600, color: s.pointDiff >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {s.pointDiff > 0 ? '+' : ''}{s.pointDiff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Final Results Podium ── */}
        {tab === 'results' && tournament.status === 'completed' && (
          <div>
            <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>🏆 Final Results</h2>
            <p style={{ textAlign: 'center', marginBottom: '2rem' }}>Tournament completed!</p>
            {standings.length >= 3 && (
              <div className="podium">
                <div className="podium-place">
                  <div style={{ fontSize: '1.5rem' }}>🥈</div>
                  <div className="podium-name">{standings[1].name}</div>
                  <div className="podium-stand second"><span className="podium-num">2</span></div>
                </div>
                <div className="podium-place">
                  <div style={{ fontSize: '2rem' }}>🥇</div>
                  <div className="podium-name" style={{ fontWeight: 700 }}>{standings[0].name}</div>
                  <div className="podium-stand first"><span className="podium-num">1</span></div>
                </div>
                <div className="podium-place">
                  <div style={{ fontSize: '1.2rem' }}>🥉</div>
                  <div className="podium-name">{standings[2].name}</div>
                  <div className="podium-stand third"><span className="podium-num">3</span></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
