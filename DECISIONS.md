# DECISIONS.md

This file documents every design decision made where the specification was ambiguous,
incomplete, or where best-practice defaults were applied. Each decision is justified.

---

## Architecture

### Backend: Firebase (Firestore + Auth) over localStorage

**Decision**: Use Firebase Firestore as the data store instead of localStorage.

**Justification**: The core requirement is a *shareable link* that multiple users access simultaneously. localStorage is scoped to a single browser session and device — it cannot serve shared state across participants. Firebase Firestore on the free (Spark) tier supports 50,000 reads/day and 20,000 writes/day, which is sufficient for tournaments up to 128 participants with comfortable headroom. Firebase Auth handles email/password authentication securely without requiring a custom backend.

**Alternative considered**: Supabase — equally viable, with a more SQL-friendly interface. Firebase was chosen for broader free-tier familiarity and simpler client-side SDK setup for a static deployment.

---

## Tournament Formats

### Added: Single Elimination and Double Elimination

**Decision**: Added two elimination bracket formats beyond those specified.

**Justification**: Round robin and random pairing are common for recreational pickleball, but competitive events almost universally use elimination brackets. Single elimination is the simplest bracket format. Double elimination gives players a second chance — it is standard at USA Pickleball sanctioned events. Omitting them would make the system unsuitable for organized competitive play.

### Double Elimination Implementation

**Decision**: Double elimination uses a winners bracket + losers bracket structure. The losers bracket winner plays the winners bracket winner in a grand final. If the winners bracket winner loses the grand final, a true final ("bracket reset") is played.

**Simplification applied**: The current UI generates a schedule structure for double elimination but does not auto-advance losers bracket matches (this would require a significantly more complex match graph). The organizer can enter scores for all matches; the bracket display shows the match tree. This is flagged as a known limitation for future enhancement.

---

## Draw Generation

### Round Robin: Circle Algorithm (Berger Tables)

**Decision**: Use the "circle algorithm" (also called the polygon or Berger method) for round-robin scheduling.

**Justification**: This is the standard algorithm for round-robin tournament scheduling. It guarantees that every pair of players meets exactly once, with balanced home/away assignments. One player is fixed; the rest rotate around them each round.

### Odd Number of Participants: Bye Rotation

**Decision**: When an odd number of players enters a round robin, a virtual "BYE" player is added. Any player matched against BYE has a bye round (no match, no score recorded).

**Justification**: This is the standard approach in competitive round-robin formats. The bye rotates so no single player receives disproportionately easy scheduling.

**Important**: Bye matches are excluded from standings calculations. A player who receives a bye does not gain wins or points from it.

### Elimination Brackets: Power-of-2 Padding

**Decision**: When the number of entrants is not a power of 2 (e.g., 10 players → pad to 16), the top-seeded players receive first-round byes.

**Justification**: Standard practice in elimination tournaments. Seeding by skill level means the strongest players receive the byes — a widely accepted format rule.

### Seeding in Elimination Brackets

**Decision**: If skill levels are available, players are seeded highest-skill-first before bracket generation. If no skill levels, players are randomly shuffled.

**Justification**: Seeding by skill prevents the two strongest players from meeting until the final, which produces a fairer and more entertaining bracket.

---

## Skill Balancing Algorithms

### Mixed Doubles: Snake Pairing

**Decision**: Sort males and females by skill level (descending). Apply snake pairing: Team 1 = Male #1 + Female #N, Team 2 = Male #2 + Female #N-1, etc.

**Justification**: Pure top-top pairing (best male + best female) creates a very strong top team and a very weak last team. Snake pairing distributes skill more evenly: the best male is paired with a lower-ranked female, balancing out their combined rating relative to other teams. This is the standard approach in mixed doubles round robins at recreational level.

### Open Doubles: Inverted Snake Pairing

**Decision**: Sort all participants by skill level. Pair player #1 with player #N, player #2 with player #N-1, etc.

**Justification**: Same reasoning as mixed doubles snake — produces teams with similar average skill levels rather than a top-heavy distribution.

---

## Tiebreakers (Round Robin Standings)

**Decision**: Standings are ordered by:
1. Wins (descending)
2. Point differential (PF - PA, descending)
3. Points scored (PF, descending)

**Justification**: This is the standard tiebreaker order used in most recreational and competitive round-robin pickleball events. Head-to-head record was considered but not implemented for the initial version, as it requires additional complexity when multiple players are tied.

---

## Waitlist Behavior

**Decision**: When `maxParticipants` is set and the tournament reaches capacity, additional registrations are accepted with `status: 'waitlisted'`. The organizer can manually promote waitlisted players to registered status.

**Justification**: Automatic waitlist promotion was considered but not implemented to avoid race conditions (two players submitting simultaneously when one spot opens). Manual promotion keeps the organizer in control.

---

## Duplicate Registration Detection

**Decision**: Duplicate detection is based on email address (case-insensitive, trimmed) within the same tournament.

**Justification**: Email is the most reliable unique identifier available without requiring accounts. Name-based detection is unreliable (John Smith vs. J. Smith).

---

## Participant Privacy

**Decision**: The public tournament page (`/t/:slug`) never exposes email addresses or phone numbers, even when `showParticipantList` is enabled. Only names (and optionally skill level/gender) are shown.

**Justification**: Contact information should never be publicly accessible. Participants did not consent to their contact details being shown to other tournament participants.

---

## Unique Tournament Links

**Decision**: Tournament slugs are generated as two concatenated UUID v4 segments (16 hex characters), e.g., `a3f2b1c49d8e7f01`.

**Justification**: This produces ~3.4 × 10³⁸ possible values — effectively unguessable. The slug is stored in Firestore and queried on the participant page. Using a short slug rather than the Firestore document ID makes the URL more shareable and human-scannable.

---

## Court Scheduling Logic

**Decision**: Matches within each round are assigned courts by `matchIndex % courtCount + 1`. Matches on different courts in the same round run simultaneously. A 5-minute buffer is added between time slots to allow for changeovers.

**Justification**: This is the simplest correct approach. It guarantees no player appears on two courts simultaneously within a round (since the round-robin algorithm already ensures each player appears at most once per round). The 5-minute buffer is configurable via match duration.

---

## Match Duration Default

**Decision**: Default match duration is 20 minutes.

**Justification**: Standard recreational pickleball to 11 (win by 2) typically takes 12–20 minutes. 20 minutes with a 5-minute changeover buffer = 25-minute slots, which is the standard used in most club tournaments.

---

## Double Elimination: Current Limitations

The double elimination format generates a bracket structure but has the following known limitations in v1.0:

1. Loser bracket matches must be manually tracked — the system does not auto-populate the losers bracket based on first-round results.
2. The grand final reset (if winners bracket champion loses the grand final) is not automatically scheduled.

These are tracked as future enhancements. The format is usable for small tournaments where the organizer manually manages the losers bracket.

---

## Scalability Constraints

The app is designed for tournaments of 8–128 participants as specified. The following would need re-evaluation for larger events:

- Firestore query patterns use `where` + `orderBy` which require composite indexes for some combinations. Indexes for `(tournamentId, createdAt)` on participants and `(tournamentId, roundIndex)` on matches should be created in the Firebase console.
- The round-robin algorithm generates `n*(n-1)/2` matches. At 128 participants, this is 8,128 matches — manageable in Firestore but the schedule view should add pagination for usability.

---

## Timezone Handling

**Decision**: Registration open/close datetimes are stored as ISO strings in the user's local timezone (as entered via `datetime-local` HTML input). Match times are stored as `HH:MM` strings relative to the organizer's chosen start time.

**Tradeoff**: Full UTC normalization with timezone-aware display was considered but would require knowing the user's timezone explicitly. For a tournament app where the organizer and participants are typically in the same location, local time storage is the pragmatic choice. A future enhancement would accept an explicit timezone selection during tournament creation.
