import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getTournament, getParticipants, updateTournament,
  updateParticipant, deleteParticipant, saveTeams, getTeams,
  saveMatches, getMatches, updateMatch
} from '../utils/firestore';
import {
  generateRoundRobin, generateSingleElimination,
  generateMixedDoublesPairings, generateOpenDoublesPairings,
  calculateStandings, shuffleArray, formatStatus, statusBadgeClass,
  getFormatById, SKILL_LEVELS, getRoundName
} from '../utils/drawEngine';

const TABS = ['Overview', 'Participants', 'Pairings/Draw', 'Schedule', 'Standings', 'Results'];

export default function OrganizerPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Overview');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(params.get('created') ? '🎉 Tournament created! Share the link below with participants.' : '');
  const [pairingWarnings, setPairingWarnings] = useState([]);
  const [generatedPairings, setGeneratedPairings] = useState(null);
  const [generatingDraw, setGeneratingDraw] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [editingSkill, setEditingSkill] = useState({});

  const reload = useCallback(async () => {
    try {
      console.log('[OrganizerPage] reload called. id:', id, 'user:', user?.uid, 'authLoading:', authLoading);
      const [t, p, tm, m] = await Promise.all([
        getTournament(id),
        getParticipants(id),
        getTeams(id),
        getMatches(id),
      ]);
      console.log('[OrganizerPage] getTournament result:', t);
      if (!t) { console.log('[OrganizerPage] tournament is null/undefined - NOT navigating'); setLoading(false); return; }
      if (user && t.organizerId !== user.uid) { console.log('[OrganizerPage] organizerId mismatch, navigating away'); navigate('/dashboard'); return; }
      setTournament(t);
      setParticipants(p);
      setTeams(tm);
      setMatches(m);
    } catch (e) {
      console.error('[OrganizerPage] reload ERROR:', e.code, e.message, e);
      setError('Failed to load: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [id, user, navigate]);

  useEffect(() => { if (!authLoading) reload(); }, [reload, authLoading]);

  // Guard: render nothing until data is loaded
  if (loading || authLoading) return <div className="loading-page"><div className="spinner" /><p>Loading tournament…</p></div>;
  if (!tournament) return <div className="loading-page"><p>Tournament not found.</p></div>;

  const tournamentLink = `${window.location.origin}/pickleball-tournament/#/t/${tournament?.slug}`;
  const fmt = tournament ? getFormatById(tournament.format) : null;
  const isTeamFormat = fmt?.requiresTeamReg || ['mixed_doubles_random', 'open_doubles_random'].includes(tournament?.format);
  const isElimination = ['single_elimination', 'double_elimination'].includes(tournament?.format);
  const isRoundRobin = ['individual_round_robin', 'mixed_doubles_random', 'open_doubles_random', 'team_registration'].includes(tournament?.format);

  // Entrants are teams or individual participants depending on format
  const entrants = isTeamFormat && teams.length > 0 ? teams :
    participants.filter(p => p.status === 'registered');

  const standings = isRoundRobin && matches.length > 0 ? calculateStandings(entrants, matches) : [];

  const updateStatus = async (status) => {
    try {
      await updateTournament(id, { status });
      setTournament(prev => ({ ...prev, status }));
      setSuccess(`Status updated to "${formatStatus(status)}"`);
      setTimeout(() => setSuccess(''), 4000);
    } catch { setError('Failed to update status.'); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(tournamentLink).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    });
  };

  const handleDeleteParticipant = async (pid) => {
    if (!window.confirm('Remove this participant?')) return;
    await deleteParticipant(pid);
    await updateTournament(id, { participantCount: participants.filter(p => p.id !== pid && p.status === 'registered').length });
    reload();
  };

  const handleSkillUpdate = async (pid, value) => {
    await updateParticipant(pid, { skillLevel: parseFloat(value) });
    setEditingSkill(prev => ({ ...prev, [pid]: false }));
    reload();
  };

  const handlePromoteWaitlist = async (pid) => {
    await updateParticipant(pid, { status: 'registered' });
    await updateTournament(id, { participantCount: (tournament.participantCount || 0) + 1 });
    reload();
  };

  const generatePairings = () => {
    const active = participants.filter(p => p.status === 'registered');
    let result;
    if (tournament.format === 'mixed_doubles_random') {
      result = generateMixedDoublesPairings(active);
    } else {
      result = generateOpenDoublesPairings(active);
    }
    setPairingWarnings(result.warnings);
    setGeneratedPairings(result.teams);
  };

  const confirmPairings = async () => {
    setGeneratingDraw(true);
    try {
      const saved = await saveTeams(id, generatedPairings);
      const drawEntrants = saved;
      let rounds;
      if (isElimination) {
        const seeded = tournament.requiresSkillLevel
          ? [...drawEntrants].sort((a, b) => (b.combinedSkill || 3) - (a.combinedSkill || 3))
          : shuffleArray(drawEntrants);
        rounds = generateSingleElimination(seeded, tournament.courts, tournament.matchDuration, tournament.startTime);
      } else {
        const seeded = tournament.requiresSkillLevel
          ? [...drawEntrants].sort((a, b) => (b.combinedSkill || b.skillLevel || 3) - (a.combinedSkill || a.skillLevel || 3))
          : shuffleArray(drawEntrants);
        rounds = generateRoundRobin(seeded, tournament.courts, tournament.matchDuration, tournament.startTime);
      }
      await saveMatches(id, rounds);
      await updateTournament(id, { status: 'draw_generated' });
      setGeneratedPairings(null);
      reload();
      setTab('Schedule');
    } catch (e) { setError('Failed to generate draw: ' + e.message); }
    finally { setGeneratingDraw(false); }
  };

  const generateDirectDraw = async () => {
    setGeneratingDraw(true);
    try {
      const active = participants.filter(p => p.status === 'registered');
      const seeded = tournament.requiresSkillLevel
        ? [...active].sort((a, b) => (b.skillLevel || 3) - (a.skillLevel || 3))
        : shuffleArray(active);
      let rounds;
      if (isElimination) {
        rounds = generateSingleElimination(seeded, tournament.courts, tournament.matchDuration, tournament.startTime);
      } else {
        rounds = generateRoundRobin(seeded, tournament.courts, tournament.matchDuration, tournament.startTime);
      }
      await saveMatches(id, rounds);
      await updateTournament(id, { status: 'draw_generated' });
      reload();
      setTab('Schedule');
    } catch (e) { setError('Failed to generate draw: ' + e.message); }
    finally { setGeneratingDraw(false); }
  };

  const handleScoreUpdate = async (matchId, field, value) => {
    await updateMatch(matchId, { [field]: value });
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, [field]: value } : m));
  };

  const submitScore = async (match) => {
    const s1 = parseInt(match.score1);
    const s2 = parseInt(match.score2);
    if (isNaN(s1) || isNaN(s2)) { setError('Enter valid scores.'); return; }
    const winner = s1 > s2 ? match.player1Id : match.player2Id;
    const winnerName = s1 > s2 ? match.player1Name : match.player2Name;
    await updateMatch(match.id, { score1: s1, score2: s2, winner, winnerName });
    // For elimination: advance winner to next round
    if (isElimination && match.nextMatchIndex !== undefined) {
      const nextRoundMatches = matches.filter(m => m.roundIndex === match.roundIndex + 1);
      const nextMatch = nextRoundMatches[match.nextMatchIndex];
      if (nextMatch) {
        const isSlot1 = match.matchIndex % 2 === 0;
        await updateMatch(nextMatch.id, isSlot1
          ? { player1Id: winner, player1Name: winnerName }
          : { player2Id: winner, player2Name: winnerName }
        );
      }
    }
    reload();
    await updateTournament(id, { status: 'in_progress' });
  };

  const groupedMatches = matches.reduce((acc, m) => {
    if (!acc[m.roundIndex]) acc[m.roundIndex] = [];
    acc[m.roundIndex].push(m);
    return acc;
  }, {});
  const totalRounds = Object.keys(groupedMatches).length;


  return (
    <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '4rem' }}>
      {/* Header */}
      <button onClick={() => navigate('/dashboard')} className="btn btn-ghost btn-sm mb-2 no-print">← Dashboard</button>
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="d-flex align-center gap-1 mb-1">
              <span className={`badge ${statusBadgeClass(tournament.status)}`}>{formatStatus(tournament.status)}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Organizer View</span>
            </div>
            <h1 style={{ marginBottom: '0.25rem' }}>{tournament.name}</h1>
            <p>📍 {tournament.location} &nbsp;·&nbsp; 📅 {tournament.eventDate} &nbsp;·&nbsp; 🎮 {fmt?.label || tournament.format}</p>
          </div>
          <div className="d-flex gap-1 flex-wrap no-print">
            {tournament.status === 'draft' && <button onClick={() => updateStatus('open')} className="btn btn-primary">Open Registration</button>}
            {tournament.status === 'open' && <button onClick={() => updateStatus('closed')} className="btn btn-outline">Close Registration</button>}
            {tournament.status === 'in_progress' && <button onClick={() => updateStatus('completed')} className="btn btn-primary">Mark Completed</button>}
            <button onClick={() => window.print()} className="btn btn-ghost btn-sm">🖨 Print</button>
          </div>
        </div>
      </div>

      {success && <div className="alert alert-success mb-3" role="alert"><span className="alert-icon">✅</span><span>{success}</span></div>}
      {error && <div className="alert alert-danger mb-3" role="alert"><span className="alert-icon">⚠️</span><span>{error}</span><button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} aria-label="Dismiss">×</button></div>}

      {/* Tabs */}
      <div className="tabs no-print" role="tablist">
        {TABS.map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)} role="tab" aria-selected={tab === t}>{t}</button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'Overview' && (
        <div>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-value">{participants.filter(p => p.status === 'registered').length}</div><div className="stat-label">Registered</div></div>
            <div className="stat-card"><div className="stat-value">{participants.filter(p => p.status === 'waitlisted').length}</div><div className="stat-label">Waitlisted</div></div>
            <div className="stat-card"><div className="stat-value">{matches.length}</div><div className="stat-label">Matches</div></div>
            <div className="stat-card"><div className="stat-value">{matches.filter(m => m.winner).length}</div><div className="stat-label">Completed</div></div>
            <div className="stat-card"><div className="stat-value">{tournament.courts}</div><div className="stat-label">Courts</div></div>
          </div>

          <div className="section">
            <h3 className="section-title">🔗 Participant Link</h3>
            <div className="card">
              <div className="card-body">
                <p style={{ fontSize: '0.875rem', marginBottom: '0.875rem' }}>Share this link with participants to register for the tournament.</p>
                <div className="copy-row">
                  <input className="form-control" readOnly value={tournamentLink} aria-label="Tournament link" />
                  <button onClick={copyLink} className="btn btn-primary btn-sm no-print" aria-label="Copy link">Copy</button>
                </div>
                {copySuccess && <div className="copy-success mt-1">✓ Copied to clipboard!</div>}
              </div>
            </div>
          </div>

          {tournament.description && (
            <div className="section">
              <h3 className="section-title">📋 Description</h3>
              <div className="card"><div className="card-body"><p>{tournament.description}</p></div></div>
            </div>
          )}

          <div className="section">
            <h3 className="section-title">⚙️ Tournament Settings</h3>
            <div className="card">
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                  {[
                    ['Format', fmt?.label || tournament.format],
                    ['Courts', tournament.courts],
                    ['Match Duration', `${tournament.matchDuration} min`],
                    ['Skill Levels', tournament.requiresSkillLevel ? (tournament.skillLevelAssignment === 'self' ? 'Self-reported' : 'Organizer assigns') : 'Not required'],
                    ['Max Participants', tournament.maxParticipants || 'Unlimited'],
                    ['Registration Opens', tournament.registrationOpen || '—'],
                    ['Registration Closes', tournament.registrationClose || '—'],
                    ['Show Participant List', tournament.showParticipantList ? 'Yes' : 'No'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>{k}</div>
                      <div style={{ fontWeight: 500 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Participants ── */}
      {tab === 'Participants' && (
        <div>
          <div className="d-flex justify-between align-center mb-3 no-print">
            <h2 style={{ margin: 0 }}>Participants ({participants.filter(p => p.status === 'registered').length})</h2>
          </div>

          {participants.filter(p => p.status === 'waitlisted').length > 0 && (
            <div className="alert alert-warning mb-3">
              <span className="alert-icon">⏳</span>
              <span>{participants.filter(p => p.status === 'waitlisted').length} player(s) on the waitlist.</span>
            </div>
          )}

          <div className="table-wrapper mb-3">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  {tournament.collectGender && <th>Gender</th>}
                  {tournament.requiresSkillLevel && <th>Skill</th>}
                  <th>Status</th>
                  <th>Registered</th>
                  <th className="no-print">Actions</th>
                </tr>
              </thead>
              <tbody>
                {participants.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No participants yet. Share the tournament link!</td></tr>
                ) : (
                  participants.map((p, i) => (
                    <tr key={p.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{p.name}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{p.email}</td>
                      {tournament.collectGender && <td>{p.gender ? (p.gender === 'male' || p.gender === 'M' ? '♂ Male' : '♀ Female') : '—'}</td>}
                      {tournament.requiresSkillLevel && (
                        <td>
                          {editingSkill[p.id] ? (
                            <select defaultValue={p.skillLevel || 3.0} className="form-control" style={{ width: 80, padding: '0.25rem' }}
                              onChange={e => handleSkillUpdate(p.id, e.target.value)} onBlur={() => setEditingSkill(prev => ({ ...prev, [p.id]: false }))}>
                              {SKILL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                          ) : (
                            <span style={{ cursor: 'pointer', color: 'var(--court-green)', fontWeight: 600 }}
                              onClick={() => setEditingSkill(prev => ({ ...prev, [p.id]: true }))} title="Click to edit">
                              {p.skillLevel || <span style={{ color: 'var(--text-muted)' }}>—</span>} ✏️
                            </span>
                          )}
                        </td>
                      )}
                      <td><span className={`badge ${p.status === 'registered' ? 'badge-open' : 'badge-waitlist'}`}>{p.status}</span></td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString() : '—'}
                      </td>
                      <td className="no-print">
                        <div className="d-flex gap-1">
                          {p.status === 'waitlisted' && (
                            <button onClick={() => handlePromoteWaitlist(p.id)} className="btn btn-sm btn-outline" title="Promote from waitlist">Promote</button>
                          )}
                          <button onClick={() => handleDeleteParticipant(p.id)} className="btn btn-sm btn-danger-outline" title="Remove participant" aria-label={`Remove ${p.name}`}>×</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pairings/Draw ── */}
      {tab === 'Pairings/Draw' && (
        <div>
          <div className="d-flex justify-between align-center mb-3 no-print">
            <h2 style={{ margin: 0 }}>
              {['mixed_doubles_random', 'open_doubles_random'].includes(tournament.format) ? 'Team Pairings' : 'Draw Generation'}
            </h2>
          </div>

          {matches.length > 0 && (
            <div className="alert alert-warning mb-3">
              <span className="alert-icon">⚠️</span>
              <span>A draw has already been generated. Regenerating will overwrite existing scores.</span>
            </div>
          )}

          {pairingWarnings.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              {pairingWarnings.map((w, i) => (
                <div key={i} className="alert alert-warning"><span className="alert-icon">⚠️</span><span>{w}</span></div>
              ))}
            </div>
          )}

          {/* Pairing-required formats */}
          {['mixed_doubles_random', 'open_doubles_random'].includes(tournament.format) && !generatedPairings && (
            <div>
              {teams.length > 0 && (
                <>
                  <div className="alert alert-success mb-3">
                    <span className="alert-icon">✅</span>
                    <span>{teams.length} teams confirmed. Draw has been generated.</span>
                  </div>
                  <div className="pairing-grid mb-3">
                    {teams.map((team) => (
                      <div key={team.id} className="pairing-card">
                        <div className="pairing-card-header">
                          <span className="pairing-team-num">Team {team.teamNumber}</span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Avg: {(team.combinedSkill || 0).toFixed(1)}</span>
                        </div>
                        {(team.players || []).map((player, pi) => (
                          <div key={pi} className="pairing-player">
                            <div className={`pairing-player-icon ${player.gender === 'male' || player.gender === 'M' ? 'male' : player.gender === 'female' || player.gender === 'F' ? 'female' : 'any'}`}>
                              {player.name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <span>{player.name}</span>
                            {player.skillLevel && <span className="pairing-skill-badge">{player.skillLevel}</span>}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}
              <button onClick={generatePairings} className="btn btn-primary no-print" disabled={participants.filter(p => p.status === 'registered').length < 2}>
                {teams.length > 0 ? '🔄 Re-generate Pairings' : '⚡ Generate Pairings'}
              </button>
            </div>
          )}

          {generatedPairings && (
            <div>
              <h3 style={{ marginBottom: '1rem' }}>Proposed Pairings — Review Before Confirming</h3>
              <div className="pairing-grid mb-3">
                {generatedPairings.map((team) => (
                  <div key={team.id} className="pairing-card">
                    <div className="pairing-card-header">
                      <span className="pairing-team-num">Team {team.teamNumber}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Avg: {(team.combinedSkill || 0).toFixed(1)}</span>
                    </div>
                    {(team.players || []).map((player, pi) => (
                      <div key={pi} className="pairing-player">
                        <div className={`pairing-player-icon ${player.gender === 'male' || player.gender === 'M' ? 'male' : player.gender === 'female' || player.gender === 'F' ? 'female' : 'any'}`}>
                          {player.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span>{player.name}</span>
                        {player.skillLevel && <span className="pairing-skill-badge">{player.skillLevel}</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="d-flex gap-2 no-print">
                <button onClick={confirmPairings} className="btn btn-primary" disabled={generatingDraw}>
                  {generatingDraw ? 'Generating…' : '✅ Confirm Pairings & Generate Draw'}
                </button>
                <button onClick={() => { setGeneratedPairings(null); generatePairings(); }} className="btn btn-ghost" disabled={generatingDraw}>
                  🔄 Regenerate
                </button>
                <button onClick={() => setGeneratedPairings(null)} className="btn btn-ghost" disabled={generatingDraw}>Cancel</button>
              </div>
            </div>
          )}

          {/* Direct draw formats */}
          {!['mixed_doubles_random', 'open_doubles_random'].includes(tournament.format) && (
            <div>
              {matches.length === 0 ? (
                <div>
                  <p style={{ marginBottom: '1.5rem' }}>
                    {entrants.length} participant(s) registered. The draw will use {isElimination ? 'single elimination' : 'round robin'} format
                    {tournament.requiresSkillLevel ? ', seeded by skill level.' : ' with random seeding.'}
                  </p>
                  {entrants.length < 2 ? (
                    <div className="alert alert-warning"><span className="alert-icon">⚠️</span><span>At least 2 participants are needed to generate a draw.</span></div>
                  ) : (
                    <button onClick={generateDirectDraw} className="btn btn-primary no-print" disabled={generatingDraw}>
                      {generatingDraw ? '⏳ Generating…' : `⚡ Generate ${isElimination ? 'Bracket' : 'Round Robin Schedule'}`}
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <div className="alert alert-success mb-3"><span className="alert-icon">✅</span><span>Draw generated with {matches.length} matches across {totalRounds} rounds.</span></div>
                  <button onClick={generateDirectDraw} className="btn btn-outline btn-sm no-print" disabled={generatingDraw}>
                    🔄 Regenerate Draw
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Schedule ── */}
      {tab === 'Schedule' && (
        <div>
          <div className="d-flex justify-between align-center mb-3 no-print">
            <h2 style={{ margin: 0 }}>Match Schedule</h2>
          </div>
          {matches.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">📅</div><h3>No draw yet</h3><p>Generate the draw from the Pairings/Draw tab first.</p></div>
          ) : (
            Object.entries(groupedMatches).map(([roundIdx, roundMatches]) => (
              <div key={roundIdx} className="schedule-round">
                <div className="schedule-round-header">
                  <span>⏱</span>
                  <span>{isElimination ? getRoundName(parseInt(roundIdx), totalRounds) : `Round ${parseInt(roundIdx) + 1}`}</span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— {roundMatches.filter(m => !m.isBye).length} match(es)</span>
                </div>
                {roundMatches.map(match => (
                  <div key={match.id} className={`match-row ${match.isBye ? 'bye-row' : ''}`}>
                    <span className="match-court">C{match.court}</span>
                    <span className="match-player">{match.player1Name || 'TBD'}</span>
                    <span className="match-vs">vs</span>
                    <span className="match-player">{match.player2Name || 'TBD'}</span>
                    {!match.isBye && !match.winner && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{match.time}</span>
                    )}
                    {match.isBye && <span className="badge badge-draft">BYE</span>}
                    {match.winner && (
                      <span style={{ fontSize: '0.82rem', color: 'var(--success)', fontWeight: 600 }}>
                        {match.score1}–{match.score2} ✓
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Standings ── */}
      {tab === 'Standings' && (
        <div>
          <h2 style={{ marginBottom: '1.5rem' }}>Standings</h2>
          {standings.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">📊</div><h3>No results yet</h3><p>Enter match scores in the Results tab to see standings.</p></div>
          ) : (
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
          )}
        </div>
      )}

      {/* ── Results ── */}
      {tab === 'Results' && (
        <div>
          <h2 style={{ marginBottom: '1.5rem' }}>Enter Results</h2>
          {matches.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">🏓</div><h3>No matches yet</h3><p>Generate the draw first.</p></div>
          ) : (
            Object.entries(groupedMatches).map(([roundIdx, roundMatches]) => (
              <div key={roundIdx} className="schedule-round">
                <div className="schedule-round-header">
                  <span>🏓</span>
                  <span>{isElimination ? getRoundName(parseInt(roundIdx), totalRounds) : `Round ${parseInt(roundIdx) + 1}`}</span>
                </div>
                {roundMatches.filter(m => !m.isBye).map(match => (
                  <div key={match.id} className="match-row">
                    <span className="match-court">C{match.court}</span>
                    <span className="match-player" style={{ fontWeight: match.winner === match.player1Id ? 700 : 400 }}>
                      {match.player1Name || 'TBD'}
                    </span>
                    <div className="match-score-inputs no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <input type="number" min="0" max="99" className="score-input"
                        value={match.score1 ?? ''}
                        onChange={e => handleScoreUpdate(match.id, 'score1', e.target.value)}
                        aria-label={`${match.player1Name} score`}
                        disabled={!!match.winner}
                      />
                      <span className="score-sep">–</span>
                      <input type="number" min="0" max="99" className="score-input"
                        value={match.score2 ?? ''}
                        onChange={e => handleScoreUpdate(match.id, 'score2', e.target.value)}
                        aria-label={`${match.player2Name} score`}
                        disabled={!!match.winner}
                      />
                      {!match.winner ? (
                        <button onClick={() => submitScore(match)} className="btn btn-primary btn-sm" style={{ marginLeft: '0.25rem' }} aria-label="Submit score">✓</button>
                      ) : (
                        <span style={{ color: 'var(--success)', fontWeight: 700, marginLeft: '0.25rem' }}>✓</span>
                      )}
                    </div>
                    <span className="match-player" style={{ fontWeight: match.winner === match.player2Id ? 700 : 400 }}>
                      {match.player2Name || 'TBD'}
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
