import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { createTournament } from '../utils/firestore';
import { FORMATS, SKILL_LEVELS } from '../utils/drawEngine';

const STEPS = ['Basic Info', 'Format', 'Skill Levels', 'Registration', 'Review'];

const defaultData = {
  name: '',
  location: '',
  eventDate: '',
  endDate: '',
  description: '',
  courts: 2,
  maxParticipants: '',
  format: '',
  requiresSkillLevel: false,
  skillLevelAssignment: 'self', // self | organizer
  registrationOpen: '',
  registrationClose: '',
  collectGender: true,
  collectPhone: false,
  showParticipantList: true,
  matchDuration: 20,
  startTime: '09:00',
};

export default function CreateTournamentPage() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState(defaultData);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  const update = (key, value) => {
    setData(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const validateStep = () => {
    const e = {};
    if (step === 0) {
      if (!data.name.trim()) e.name = 'Tournament name is required.';
      if (!data.location.trim()) e.location = 'Location is required.';
      if (!data.eventDate) e.eventDate = 'Event date is required.';
      if (!data.courts || data.courts < 1) e.courts = 'At least 1 court is required.';
    }
    if (step === 1) {
      if (!data.format) e.format = 'Please select a tournament format.';
    }
    if (step === 3) {
      if (!data.registrationOpen) e.registrationOpen = 'Registration open date is required.';
      if (!data.registrationClose) e.registrationClose = 'Registration close date is required.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep()) setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const back = () => setStep(s => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const selectedFormat = FORMATS.find(f => f.id === data.format);
      const payload = {
        ...data,
        courts: Number(data.courts),
        maxParticipants: data.maxParticipants ? Number(data.maxParticipants) : null,
        matchDuration: Number(data.matchDuration),
        participantCount: 0,
        waitlistCount: 0,
        collectGender: selectedFormat?.requiresGender || data.collectGender,
      };
      const { id } = await createTournament(user.uid, payload);
      navigate(`/organizer/${id}?created=1`);
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  };

  const selectedFormat = FORMATS.find(f => f.id === data.format);

  return (
    <div className="container-md" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <button onClick={() => navigate('/dashboard')} className="btn btn-ghost btn-sm">← Back to Dashboard</button>
      </div>
      <h1 style={{ marginBottom: '0.25rem' }}>Create Tournament</h1>
      <p style={{ marginBottom: '0' }}>Set up your tournament step by step.</p>

      {/* Progress */}
      <div className="wizard-progress" aria-label="Wizard progress">
        {STEPS.map((label, i) => (
          <div key={i} className={`wizard-step ${i < step ? 'done' : ''} ${i === step ? 'active' : ''}`}>
            <div className="wizard-dot" aria-current={i === step ? 'step' : undefined}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className="wizard-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-body">
          {/* Step 0: Basic Info */}
          {step === 0 && (
            <div>
              <h2 style={{ marginBottom: '1.5rem' }}>📋 Basic Information</h2>
              <div className="form-group">
                <label className="form-label" htmlFor="name">Tournament Name <span className="required">*</span></label>
                <input id="name" className={`form-control ${errors.name ? 'error' : ''}`} value={data.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Spring Pickleball Open 2025" />
                {errors.name && <span className="form-error">{errors.name}</span>}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="location">Location / Venue <span className="required">*</span></label>
                  <input id="location" className={`form-control ${errors.location ? 'error' : ''}`} value={data.location} onChange={e => update('location', e.target.value)} placeholder="e.g. Riverside Sports Complex" />
                  {errors.location && <span className="form-error">{errors.location}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="courts">Number of Courts <span className="required">*</span></label>
                  <input id="courts" type="number" min="1" max="30" className={`form-control ${errors.courts ? 'error' : ''}`} value={data.courts} onChange={e => update('courts', e.target.value)} />
                  {errors.courts && <span className="form-error">{errors.courts}</span>}
                  <span className="form-hint">Used for scheduling — matches run in parallel.</span>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="eventDate">Event Start Date <span className="required">*</span></label>
                  <input id="eventDate" type="date" className={`form-control ${errors.eventDate ? 'error' : ''}`} value={data.eventDate} onChange={e => update('eventDate', e.target.value)} />
                  {errors.eventDate && <span className="form-error">{errors.eventDate}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="endDate">Event End Date</label>
                  <input id="endDate" type="date" className="form-control" value={data.endDate} onChange={e => update('endDate', e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="startTime">Matches Start Time</label>
                  <input id="startTime" type="time" className="form-control" value={data.startTime} onChange={e => update('startTime', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="matchDuration">Match Duration (minutes)</label>
                  <select id="matchDuration" className="form-control" value={data.matchDuration} onChange={e => update('matchDuration', e.target.value)}>
                    {[15, 20, 25, 30, 45, 60].map(m => <option key={m} value={m}>{m} min</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="maxParticipants">Max Participants / Teams</label>
                  <input id="maxParticipants" type="number" min="4" className="form-control" value={data.maxParticipants} onChange={e => update('maxParticipants', e.target.value)} placeholder="Leave blank for unlimited" />
                  <span className="form-hint">Participants over the cap will be waitlisted.</span>
                </div>
                <div></div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="description">Description / Notes</label>
                <textarea id="description" className="form-control" value={data.description} onChange={e => update('description', e.target.value)} placeholder="Rules, dress code, what to bring, etc." rows={3} />
              </div>
            </div>
          )}

          {/* Step 1: Format */}
          {step === 1 && (
            <div>
              <h2 style={{ marginBottom: '0.5rem' }}>🎮 Tournament Format</h2>
              <p style={{ marginBottom: '1.5rem' }}>Choose how matches will be organized.</p>
              {errors.format && <div className="alert alert-danger mb-2">{errors.format}</div>}
              <div className="format-grid">
                {FORMATS.map(f => (
                  <div
                    key={f.id}
                    className={`format-card ${data.format === f.id ? 'selected' : ''}`}
                    onClick={() => update('format', f.id)}
                    role="radio"
                    aria-checked={data.format === f.id}
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && update('format', f.id)}
                  >
                    <div className="check" aria-hidden="true">✓</div>
                    <div className="format-card-icon">{f.icon}</div>
                    <h4>{f.label}</h4>
                    <p>{f.description}</p>
                  </div>
                ))}
              </div>
              {selectedFormat?.id === 'double_elimination' && (
                <div className="alert alert-info mt-3">
                  <span className="alert-icon">ℹ️</span>
                  <span>Double elimination uses a winners bracket + losers bracket. The losers bracket winner plays the winners bracket winner in a championship match.</span>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Skill Levels */}
          {step === 2 && (
            <div>
              <h2 style={{ marginBottom: '0.5rem' }}>⚖️ Skill Level Settings</h2>
              <p style={{ marginBottom: '1.5rem' }}>Skill levels help create balanced pairings and seedings.</p>

              <div className="form-group">
                <label className="checkbox-group">
                  <input type="checkbox" checked={data.requiresSkillLevel} onChange={e => update('requiresSkillLevel', e.target.checked)} />
                  <span>Require skill level for this tournament</span>
                </label>
                <span className="form-hint mt-1">Standard pickleball ratings: 2.0 (beginner) → 5.0+ (pro)</span>
              </div>

              {data.requiresSkillLevel && (
                <>
                  <div className="form-group">
                    <label className="form-label">How will skill levels be assigned?</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                      {[
                        { value: 'self', label: 'Self-reported', desc: 'Participants select their own skill level during registration.' },
                        { value: 'organizer', label: 'Organizer assigns', desc: 'You assign skill levels manually after registration closes.' },
                      ].map(opt => (
                        <label key={opt.value} style={{ display: 'flex', gap: '0.75rem', cursor: 'pointer', padding: '0.875rem', border: `1.5px solid ${data.skillLevelAssignment === opt.value ? 'var(--court-green)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', background: data.skillLevelAssignment === opt.value ? 'var(--success-light)' : 'white' }}>
                          <input type="radio" name="skillAssign" value={opt.value} checked={data.skillLevelAssignment === opt.value} onChange={() => update('skillLevelAssignment', opt.value)} style={{ marginTop: '2px', accentColor: 'var(--court-green)' }} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{opt.label}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{opt.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="alert alert-info">
                    <span className="alert-icon">ℹ️</span>
                    <div>
                      <strong>Skill levels used:</strong> {SKILL_LEVELS.join(', ')}
                      <br /><span style={{ fontSize: '0.8rem' }}>2.0 = beginner · 3.0 = intermediate · 4.0 = advanced · 5.0+ = professional</span>
                    </div>
                  </div>
                </>
              )}

              {!data.requiresSkillLevel && (
                <div className="alert alert-warning">
                  <span className="alert-icon">⚠️</span>
                  <span>Without skill levels, random pairings will be used for draw generation. You can still manually adjust pairings before finalizing.</span>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Registration */}
          {step === 3 && (
            <div>
              <h2 style={{ marginBottom: '0.5rem' }}>📝 Registration Settings</h2>
              <p style={{ marginBottom: '1.5rem' }}>Configure what information participants must provide.</p>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="regOpen">Registration Opens <span className="required">*</span></label>
                  <input id="regOpen" type="datetime-local" className={`form-control ${errors.registrationOpen ? 'error' : ''}`} value={data.registrationOpen} onChange={e => update('registrationOpen', e.target.value)} />
                  {errors.registrationOpen && <span className="form-error">{errors.registrationOpen}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="regClose">Registration Closes <span className="required">*</span></label>
                  <input id="regClose" type="datetime-local" className={`form-control ${errors.registrationClose ? 'error' : ''}`} value={data.registrationClose} onChange={e => update('registrationClose', e.target.value)} />
                  {errors.registrationClose && <span className="form-error">{errors.registrationClose}</span>}
                </div>
              </div>

              <div style={{ padding: '1.25rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                  Fields collected from participants
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {[
                    { key: null, label: 'Name', always: true, fixed: true },
                    { key: null, label: 'Email', always: true, fixed: true },
                    { key: 'collectPhone', label: 'Phone number', always: false },
                    { key: 'collectGender', label: 'Gender', always: selectedFormat?.requiresGender, fixed: selectedFormat?.requiresGender },
                  ].map((f, i) => (
                    <label key={i} className="checkbox-group" style={{ opacity: f.fixed ? 0.6 : 1, cursor: f.fixed ? 'default' : 'pointer' }}>
                      <input type="checkbox" checked={f.fixed ? true : data[f.key]} onChange={f.fixed ? undefined : e => update(f.key, e.target.checked)} disabled={f.fixed} />
                      <span style={{ fontSize: '0.9rem' }}>{f.label} {f.always && <span className="badge badge-draft" style={{ fontSize: '0.65rem', marginLeft: '4px' }}>required</span>}</span>
                    </label>
                  ))}
                  {data.requiresSkillLevel && data.skillLevelAssignment === 'self' && (
                    <label className="checkbox-group" style={{ opacity: 0.6, cursor: 'default' }}>
                      <input type="checkbox" checked disabled />
                      <span style={{ fontSize: '0.9rem' }}>Skill level (self-reported) <span className="badge badge-draft" style={{ fontSize: '0.65rem', marginLeft: '4px' }}>required</span></span>
                    </label>
                  )}
                  {selectedFormat?.requiresTeamReg && (
                    <label className="checkbox-group" style={{ opacity: 0.6, cursor: 'default' }}>
                      <input type="checkbox" checked disabled />
                      <span style={{ fontSize: '0.9rem' }}>Partner name <span className="badge badge-draft" style={{ fontSize: '0.65rem', marginLeft: '4px' }}>required</span></span>
                    </label>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-group">
                  <input type="checkbox" checked={data.showParticipantList} onChange={e => update('showParticipantList', e.target.checked)} />
                  <span>Allow participants to see the list of registered players</span>
                </label>
                <span className="form-hint mt-1">Names only — no contact information will be shown publicly.</span>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div>
              <h2 style={{ marginBottom: '1.5rem' }}>✅ Review & Publish</h2>
              {submitError && <div className="alert alert-danger mb-3">{submitError}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                {[
                  { icon: '📋', title: 'Basic Info', rows: [
                    ['Name', data.name],
                    ['Location', data.location],
                    ['Date', `${data.eventDate}${data.endDate ? ` → ${data.endDate}` : ''}`],
                    ['Courts', data.courts],
                    ['Match duration', `${data.matchDuration} min, starts ${data.startTime}`],
                    ['Max participants', data.maxParticipants || 'Unlimited'],
                  ]},
                  { icon: '🎮', title: 'Format', rows: [
                    ['Format', selectedFormat?.label || data.format],
                  ]},
                  { icon: '⚖️', title: 'Skill Levels', rows: [
                    ['Required', data.requiresSkillLevel ? 'Yes' : 'No'],
                    ...(data.requiresSkillLevel ? [['Assignment', data.skillLevelAssignment === 'self' ? 'Self-reported by participants' : 'Assigned by organizer']] : []),
                  ]},
                  { icon: '📝', title: 'Registration', rows: [
                    ['Opens', data.registrationOpen || 'Not set'],
                    ['Closes', data.registrationClose || 'Not set'],
                    ['Collect phone', data.collectPhone ? 'Yes' : 'No'],
                    ['Show participant list', data.showParticipantList ? 'Yes' : 'No'],
                  ]},
                ].map((section, i) => (
                  <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <div style={{ background: 'var(--surface-2)', padding: '0.625rem 1rem', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                      {section.icon} {section.title}
                    </div>
                    <div style={{ padding: '0.875rem 1rem' }}>
                      {section.rows.map(([k, v], j) => (
                        <div key={j} style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', padding: '0.2rem 0', color: v ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          <span style={{ minWidth: 160, color: 'var(--text-muted)', fontWeight: 500 }}>{k}</span>
                          <span>{v || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="alert alert-info">
                <span className="alert-icon">🔗</span>
                <span>After creating, you'll get a unique shareable link to send to participants.</span>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
            <button onClick={back} className="btn btn-ghost" disabled={step === 0} aria-label="Previous step">
              ← Back
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Step {step + 1} of {STEPS.length}</span>
            {step < STEPS.length - 1 ? (
              <button onClick={next} className="btn btn-primary" aria-label="Next step">Next →</button>
            ) : (
              <button onClick={handleSubmit} className="btn btn-accent btn-lg" disabled={submitting} aria-label="Create tournament">
                {submitting ? 'Creating…' : '🚀 Create Tournament'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
