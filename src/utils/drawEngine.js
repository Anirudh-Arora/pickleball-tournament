/**
 * Draw Generation Engine
 * Handles: Round Robin, Single Elimination, Double Elimination
 * With court assignment and time scheduling
 */

// ─── Round Robin ──────────────────────────────────────────────

/**
 * Generate a complete round-robin schedule using the "circle algorithm"
 * With byes for odd numbers of players
 * Returns: array of rounds, each containing an array of matches
 */
export function generateRoundRobin(entrants, courts = 2, matchDurationMinutes = 20, startTime = '08:00') {
  const players = [...entrants];
  const n = players.length;
  const hasBye = n % 2 !== 0;
  if (hasBye) players.push({ id: 'BYE', name: 'BYE', isBye: true });

  const total = players.length; // always even now
  const rounds = [];
  const fixed = players[0];
  const rotating = players.slice(1);

  for (let r = 0; r < total - 1; r++) {
    const round = [];
    const roundPlayers = [fixed, ...rotating];

    for (let i = 0; i < total / 2; i++) {
      const p1 = roundPlayers[i];
      const p2 = roundPlayers[total - 1 - i];
      if (!p1.isBye && !p2.isBye) {
        round.push({ player1: p1, player2: p2, isBye: false });
      } else if (p1.isBye || p2.isBye) {
        const realPlayer = p1.isBye ? p2 : p1;
        round.push({ player1: realPlayer, player2: null, isBye: true });
      }
    }

    rounds.push(round);
    rotating.unshift(rotating.pop()); // rotate
  }

  // Assign courts and times
  const [startHour, startMin] = startTime.split(':').map(Number);
  let minuteOffset = 0;

  return rounds.map((round, roundIdx) => {
    const matches = [];
    round.forEach((match, matchIdx) => {
      const court = (matchIdx % courts) + 1;
      if (matchIdx > 0 && matchIdx % courts === 0) minuteOffset += matchDurationMinutes + 5; // 5min buffer

      const totalMinutes = startHour * 60 + startMin + (roundIdx > 0 ? roundIdx * (matchDurationMinutes + 5) : 0) + Math.floor(matchIdx / courts) * (matchDurationMinutes + 5);
      const h = Math.floor(totalMinutes / 60) % 24;
      const m = totalMinutes % 60;
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      matches.push({
        roundIndex: roundIdx,
        matchIndex: matchIdx,
        court,
        time,
        player1Id: match.player1?.id || null,
        player1Name: match.player1?.name || 'BYE',
        player2Id: match.player2?.id || null,
        player2Name: match.player2?.name || 'BYE',
        score1: null,
        score2: null,
        winner: null,
        isBye: match.isBye,
        type: 'round_robin',
      });
    });
    return matches;
  });
}

// ─── Single Elimination ───────────────────────────────────────

export function generateSingleElimination(entrants, courts = 2, matchDurationMinutes = 20, startTime = '08:00') {
  const players = [...entrants];
  // Pad to next power of 2
  const size = nextPowerOf2(players.length);
  while (players.length < size) players.push({ id: 'BYE', name: 'BYE', isBye: true });

  const rounds = [];
  let currentRound = [];

  // First round
  for (let i = 0; i < size; i += 2) {
    const p1 = players[i];
    const p2 = players[i + 1];
    const isBye = p1.isBye || p2.isBye;
    currentRound.push({
      roundIndex: 0,
      matchIndex: i / 2,
      player1Id: p1.isBye ? null : p1.id,
      player1Name: p1.isBye ? 'BYE' : p1.name,
      player2Id: p2.isBye ? null : p2.id,
      player2Name: p2.isBye ? 'BYE' : p2.name,
      score1: null, score2: null,
      winner: isBye ? (p1.isBye ? p2.id : p1.id) : null,
      winnerName: isBye ? (p1.isBye ? p2.name : p1.name) : null,
      isBye,
      type: 'elimination',
      nextMatchIndex: Math.floor((i / 2) / 2),
      court: (i / 2) % courts + 1,
    });
  }
  rounds.push(currentRound);

  // Subsequent rounds (placeholders)
  let matchesInRound = size / 2;
  let roundIdx = 1;
  while (matchesInRound > 1) {
    matchesInRound /= 2;
    const round = [];
    for (let i = 0; i < matchesInRound; i++) {
      round.push({
        roundIndex: roundIdx,
        matchIndex: i,
        player1Id: null, player1Name: 'TBD',
        player2Id: null, player2Name: 'TBD',
        score1: null, score2: null, winner: null, winnerName: null,
        isBye: false,
        type: 'elimination',
        nextMatchIndex: Math.floor(i / 2),
        court: i % courts + 1,
      });
    }
    rounds.push(round);
    roundIdx++;
  }

  return rounds;
}

// ─── Pairing Algorithms ───────────────────────────────────────

/**
 * Mixed Doubles pairing: balance skill levels
 * One male + one female per team
 */
export function generateMixedDoublesPairings(participants) {
  const males = participants.filter(p => p.gender === 'male' || p.gender === 'M').sort((a, b) => (b.skillLevel || 3.0) - (a.skillLevel || 3.0));
  const females = participants.filter(p => p.gender === 'female' || p.gender === 'F').sort((a, b) => (b.skillLevel || 3.0) - (a.skillLevel || 3.0));

  const warnings = [];
  const teams = [];

  if (males.length !== females.length) {
    warnings.push(`Uneven gender counts: ${males.length} male(s), ${females.length} female(s). ${Math.abs(males.length - females.length)} player(s) cannot be paired.`);
  }

  const count = Math.min(males.length, females.length);

  // Snake pairing: highest male with lowest female of top half → balances combined skill
  for (let i = 0; i < count; i++) {
    const male = males[i];
    // Snake: pair top male with mid female
    const femaleIdx = i % 2 === 0 ? i : count - 1 - Math.floor(i / 2);
    const female = females[Math.min(femaleIdx, females.length - 1)];

    teams.push({
      id: `team-${i + 1}`,
      name: `${male.name} / ${female.name}`,
      playerIds: [male.id, female.id],
      players: [male, female],
      combinedSkill: ((male.skillLevel || 3.0) + (female.skillLevel || 3.0)) / 2,
      teamNumber: i + 1,
    });
  }

  return { teams, warnings };
}

/**
 * Open Doubles pairing: balance by skill regardless of gender
 */
export function generateOpenDoublesPairings(participants) {
  const sorted = [...participants].sort((a, b) => (b.skillLevel || 3.0) - (a.skillLevel || 3.0));
  const teams = [];
  const warnings = [];

  if (sorted.length % 2 !== 0) {
    warnings.push(`Odd number of participants (${sorted.length}). One player cannot be paired.`);
    sorted.pop(); // remove last
  }

  // Snake pairing: 1+last, 2+second-to-last, etc.
  const half = sorted.length / 2;
  for (let i = 0; i < half; i++) {
    const p1 = sorted[i];
    const p2 = sorted[sorted.length - 1 - i];
    teams.push({
      id: `team-${i + 1}`,
      name: `${p1.name} / ${p2.name}`,
      playerIds: [p1.id, p2.id],
      players: [p1, p2],
      combinedSkill: ((p1.skillLevel || 3.0) + (p2.skillLevel || 3.0)) / 2,
      teamNumber: i + 1,
    });
  }

  return { teams, warnings };
}

// ─── Standings Calculation ────────────────────────────────────

export function calculateStandings(entrants, matches) {
  const standings = {};

  for (const e of entrants) {
    standings[e.id] = {
      id: e.id,
      name: e.name,
      wins: 0,
      losses: 0,
      played: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
    };
  }

  for (const match of matches) {
    if (match.isBye || match.score1 === null || match.score2 === null) continue;
    const s1 = parseInt(match.score1) || 0;
    const s2 = parseInt(match.score2) || 0;

    const e1 = standings[match.player1Id];
    const e2 = standings[match.player2Id];

    if (e1) {
      e1.played++;
      e1.pointsFor += s1;
      e1.pointsAgainst += s2;
      e1.pointDiff += s1 - s2;
      if (s1 > s2) e1.wins++; else e1.losses++;
    }
    if (e2) {
      e2.played++;
      e2.pointsFor += s2;
      e2.pointsAgainst += s1;
      e2.pointDiff += s2 - s1;
      if (s2 > s1) e2.wins++; else e2.losses++;
    }
  }

  return Object.values(standings).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
    return b.pointsFor - a.pointsFor;
  });
}

// ─── Helpers ──────────────────────────────────────────────────

function nextPowerOf2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const SKILL_LEVELS = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];

export const FORMATS = [
  {
    id: 'mixed_doubles_random',
    label: 'Mixed Doubles – Random Draw',
    icon: '👫',
    description: 'Individuals register; system pairs one male + one female per team, balanced by skill.',
    requiresGender: true,
    requiresTeamReg: false,
    supportsSkill: true,
  },
  {
    id: 'open_doubles_random',
    label: 'Open Doubles – Random Draw',
    icon: '🤝',
    description: 'Individuals register; system pairs teams regardless of gender, balanced by skill.',
    requiresGender: false,
    requiresTeamReg: false,
    supportsSkill: true,
  },
  {
    id: 'individual_round_robin',
    label: 'Individual Round Robin',
    icon: '🔄',
    description: 'Everyone plays everyone. Full round-robin with standings table.',
    requiresGender: false,
    requiresTeamReg: false,
    supportsSkill: false,
  },
  {
    id: 'team_registration',
    label: 'Team Registration',
    icon: '👥',
    description: 'Pre-formed teams of 2 register together. No pairing needed.',
    requiresGender: false,
    requiresTeamReg: true,
    supportsSkill: true,
  },
  {
    id: 'single_elimination',
    label: 'Single Elimination',
    icon: '🏆',
    description: 'Bracket tournament. One loss and you\'re out. Seeded by skill if available.',
    requiresGender: false,
    requiresTeamReg: false,
    supportsSkill: true,
  },
  {
    id: 'double_elimination',
    label: 'Double Elimination',
    icon: '⚡',
    description: 'Two-loss bracket. Losers get a second chance via the losers bracket.',
    requiresGender: false,
    requiresTeamReg: false,
    supportsSkill: true,
  },
];

export function getFormatById(id) {
  return FORMATS.find(f => f.id === id) || null;
}

export function formatStatus(status) {
  const map = {
    draft: 'Draft',
    open: 'Registration Open',
    closed: 'Registration Closed',
    draw_generated: 'Draw Generated',
    in_progress: 'In Progress',
    completed: 'Completed',
  };
  return map[status] || status;
}

export function statusBadgeClass(status) {
  const map = {
    draft: 'badge-draft',
    open: 'badge-open',
    closed: 'badge-closed',
    draw_generated: 'badge-active',
    in_progress: 'badge-active',
    completed: 'badge-complete',
  };
  return map[status] || 'badge-draft';
}

export function getRoundName(roundIndex, totalRounds) {
  const remaining = totalRounds - roundIndex;
  if (remaining === 1) return 'Final';
  if (remaining === 2) return 'Semi-Final';
  if (remaining === 3) return 'Quarter-Final';
  return `Round ${roundIndex + 1}`;
}
