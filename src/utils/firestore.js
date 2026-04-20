import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, where, orderBy, serverTimestamp, deleteDoc, setDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { v4 as uuidv4 } from 'uuid';

// ─── Tournaments ─────────────────────────────────────────────

export async function createTournament(organizerId, data) {
  const slug = uuidv4().split('-')[0] + uuidv4().split('-')[0]; // 16-char unique slug
  const ref = await addDoc(collection(db, 'tournaments'), {
    ...data,
    organizerId,
    slug,
    status: 'draft',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, slug };
}

export async function updateTournament(id, data) {
  await updateDoc(doc(db, 'tournaments', id), { ...data, updatedAt: serverTimestamp() });
}

export async function getTournament(id) {
  const snap = await getDoc(doc(db, 'tournaments', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getTournamentBySlug(slug) {
  const q = query(collection(db, 'tournaments'), where('slug', '==', slug));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function getOrganizerTournaments(organizerId) {
  const q = query(
    collection(db, 'tournaments'),
    where('organizerId', '==', organizerId)
  );
  const snap = await getDocs(q);
  // Sort client-side to avoid needing a composite index
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export async function deleteTournament(id) {
  await deleteDoc(doc(db, 'tournaments', id));
}

// ─── Participants ─────────────────────────────────────────────

export async function registerParticipant(tournamentId, data) {
  // Check for duplicate
  const q = query(
    collection(db, 'participants'),
    where('tournamentId', '==', tournamentId),
    where('email', '==', data.email.toLowerCase().trim())
  );
  const existing = await getDocs(q);
  if (!existing.empty) throw new Error('This email is already registered for this tournament.');

  const ref = await addDoc(collection(db, 'participants'), {
    ...data,
    email: data.email.toLowerCase().trim(),
    tournamentId,
    status: 'registered', // registered | waitlisted | withdrawn
    teamId: null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getParticipants(tournamentId) {
  const q = query(
    collection(db, 'participants'),
    where('tournamentId', '==', tournamentId)
  );
  const snap = await getDocs(q);
  // Sort client-side to avoid needing a composite index
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const ta = a.createdAt?.seconds || 0;
      const tb = b.createdAt?.seconds || 0;
      return ta - tb;
    });
}

export async function updateParticipant(id, data) {
  await updateDoc(doc(db, 'participants', id), data);
}

export async function deleteParticipant(id) {
  await deleteDoc(doc(db, 'participants', id));
}

// ─── Teams ─────────────────────────────────────────────────────

export async function saveTeams(tournamentId, teams) {
  // Delete existing teams first
  const q = query(collection(db, 'teams'), where('tournamentId', '==', tournamentId));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));

  // Save new teams
  const saved = [];
  for (const team of teams) {
    const ref = await addDoc(collection(db, 'teams'), {
      ...team,
      tournamentId,
      createdAt: serverTimestamp(),
    });
    saved.push({ id: ref.id, ...team });
  }

  // Update participant teamIds
  for (const team of saved) {
    for (const pid of team.playerIds) {
      await updateDoc(doc(db, 'participants', pid), { teamId: team.id });
    }
  }
  return saved;
}

export async function getTeams(tournamentId) {
  const q = query(collection(db, 'teams'), where('tournamentId', '==', tournamentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Matches ──────────────────────────────────────────────────

export async function saveMatches(tournamentId, rounds) {
  // Delete existing
  const q = query(collection(db, 'matches'), where('tournamentId', '==', tournamentId));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));

  const saved = [];
  for (const match of rounds.flat()) {
    const ref = await addDoc(collection(db, 'matches'), {
      ...match,
      tournamentId,
      createdAt: serverTimestamp(),
    });
    saved.push({ id: ref.id, ...match });
  }
  return saved;
}

export async function getMatches(tournamentId) {
  const q = query(
    collection(db, 'matches'),
    where('tournamentId', '==', tournamentId)
  );
  const snap = await getDocs(q);
  // Sort client-side to avoid needing a composite index
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.roundIndex - b.roundIndex || a.matchIndex - b.matchIndex);
}

export async function updateMatch(id, data) {
  await updateDoc(doc(db, 'matches', id), { ...data, updatedAt: serverTimestamp() });
}
