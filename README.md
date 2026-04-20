# 🏓 PickleHQ — Pickleball Tournament Organizer

A complete, production-ready web application for creating and managing pickleball tournaments. Organizers create tournaments, manage registrations, generate draws, and track results. Participants register and follow their schedule via a unique shareable link — no account required.

---

## ✨ Features

### For Organizers
- **5-step tournament creation wizard** covering format, skill levels, courts, and registration settings
- **6 tournament formats**: Mixed Doubles Random Draw, Open Doubles Random Draw, Individual Round Robin, Team Registration, Single Elimination, Double Elimination
- **Smart draw generation**: Skill-balanced pairings, bye rotation for odd numbers, power-of-2 bracket padding
- **Participant management**: Approve/remove registrations, assign skill levels, promote from waitlist
- **Live results entry**: Enter scores match-by-match; standings update automatically
- **Print-ready schedule** with court assignments and estimated times

### For Participants
- **No account required** — register via unique tournament link
- View registered player list, match schedule, live standings, and final results
- Waitlist support when tournament reaches capacity

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6 |
| Database | Firebase Firestore (free tier) |
| Authentication | Firebase Auth (email/password) |
| Styling | Custom CSS (no framework) with CSS variables |
| Fonts | Syne (headings) + DM Sans (body) via Google Fonts |
| Deployment | Vercel / Firebase Hosting / GitHub Pages |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- A [Firebase project](https://console.firebase.google.com) (free Spark plan is sufficient)

### 1. Clone & Install

```bash
git clone https://github.com/yourname/pickleball-tournament.git
cd pickleball-tournament
npm install
```

### 2. Set Up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com) → Create a project
2. **Enable Firestore**: Build → Firestore Database → Create database → Start in production mode
3. **Enable Authentication**: Build → Authentication → Sign-in method → Enable **Email/Password**
4. **Register a web app**: Project Settings → Your Apps → Add app (Web) → Copy config

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your Firebase config values:

```env
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 4. Deploy Firestore Security Rules

Install the Firebase CLI if you haven't:
```bash
npm install -g firebase-tools
firebase login
firebase init firestore  # select your project, use existing firestore.rules
firebase deploy --only firestore:rules
```

### 5. Create Firestore Indexes

In the Firebase Console → Firestore → Indexes, create these **composite indexes**:

| Collection | Fields | Order |
|---|---|---|
| `tournaments` | `organizerId` ASC, `createdAt` DESC | — |
| `participants` | `tournamentId` ASC, `email` ASC | — |
| `participants` | `tournamentId` ASC, `createdAt` ASC | — |
| `matches` | `tournamentId` ASC, `roundIndex` ASC | — |
| `teams` | `tournamentId` ASC | — |

> Firebase will also prompt you to create missing indexes the first time a query runs — click the link in the browser console.

### 6. Run Locally

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) — that's it!

---

## 🌐 Deployment

### Deploy to Vercel (Recommended)

1. Push your repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Add all `REACT_APP_*` environment variables in the Vercel dashboard
4. Deploy — Vercel auto-detects Create React App

```bash
# Or via CLI:
npm install -g vercel
vercel --prod
```

### Deploy to Firebase Hosting

```bash
npm run build
firebase init hosting  # set build/ as public dir, configure as SPA
firebase deploy
```

### Deploy to GitHub Pages

Add `"homepage": "https://yourusername.github.io/pickleball-tournament"` to `package.json`, then:

```bash
npm install --save-dev gh-pages
# Add to package.json scripts:
# "predeploy": "npm run build",
# "deploy": "gh-pages -d build"
npm run deploy
```

> **Note**: React Router requires `HashRouter` for GitHub Pages (no server-side redirect support). Change `BrowserRouter` to `HashRouter` in `App.js` if deploying to GitHub Pages.

---

## 📁 Project Structure

```
pickleball-tournament/
├── public/
│   └── index.html               # HTML entry point
├── src/
│   ├── App.js                   # Routes + AuthProvider
│   ├── index.js                 # React entry point
│   ├── firebase.js              # Firebase initialization
│   ├── styles/
│   │   └── main.css             # Full design system
│   ├── hooks/
│   │   └── useAuth.js           # Authentication context
│   ├── utils/
│   │   ├── firestore.js         # Database operations
│   │   └── drawEngine.js        # Draw generation algorithms
│   ├── components/
│   │   └── shared/
│   │       ├── NavBar.jsx       # Top navigation
│   │       └── ProtectedRoute.jsx
│   └── pages/
│       ├── HomePage.jsx         # Landing page
│       ├── AuthPages.jsx        # Login + Register
│       ├── DashboardPage.jsx    # Organizer dashboard
│       ├── CreateTournamentPage.jsx  # 5-step wizard
│       ├── OrganizerPage.jsx    # Tournament management
│       └── ParticipantPage.jsx  # Public tournament view
├── firestore.rules              # Firestore security rules
├── .env.example                 # Environment variable template
├── .gitignore
├── DECISIONS.md                 # Design decision log
└── package.json
```

---

## 🎮 Tournament Formats

| Format | Description | Pairing | Draw Type |
|---|---|---|---|
| Mixed Doubles – Random Draw | 1 male + 1 female per team, skill-balanced | Auto (snake) | Round Robin |
| Open Doubles – Random Draw | Any 2 players, skill-balanced | Auto (inverted snake) | Round Robin |
| Individual Round Robin | Everyone plays everyone | None (individual) | Round Robin |
| Team Registration | Pre-formed pairs register together | Pre-formed | Round Robin |
| Single Elimination | Classic bracket, one loss = out | None / seeded | Bracket |
| Double Elimination | Two-loss bracket with second chance | None / seeded | Bracket |

---

## 📊 Data Model

```
tournaments/{id}
  - name, location, eventDate, endDate
  - organizerId (Firebase Auth UID)
  - slug (unique 16-char public identifier)
  - format, status
  - courts, matchDuration, startTime
  - requiresSkillLevel, skillLevelAssignment
  - maxParticipants, participantCount, waitlistCount
  - registrationOpen, registrationClose
  - collectGender, collectPhone, showParticipantList
  - description

participants/{id}
  - tournamentId, name, email, phone, gender
  - skillLevel, partnerName
  - status (registered | waitlisted | withdrawn)
  - teamId (set after pairing)

teams/{id}
  - tournamentId, name, teamNumber
  - playerIds[], players[]
  - combinedSkill

matches/{id}
  - tournamentId, roundIndex, matchIndex
  - player1Id, player1Name, player2Id, player2Name
  - score1, score2, winner, winnerName
  - court, time, isBye
  - type (round_robin | elimination)
  - nextMatchIndex (for elimination advancement)
```

---

## 🔒 Security Model

- **Firestore rules** enforce that only the tournament organizer (matched by Firebase Auth UID) can modify tournament data, participants, teams, and matches
- **Public routes** (`/t/:slug`) allow unauthenticated read of tournament data and participant registration
- **Contact information** (email, phone) is never exposed on the public participant page — names only
- **Participant registration** allows unauthenticated writes to the `participants` collection for the specific tournament only

---

## 🧩 Known Limitations & Future Enhancements

- [ ] **Double elimination losers bracket**: Auto-population of losers bracket after each round not yet implemented
- [ ] **Confirmation emails**: Email notifications on registration (would require a cloud function or third-party service like SendGrid)
- [ ] **Score editing**: Submitted scores cannot currently be edited (delete + re-enter)
- [ ] **Timezone display**: Datetimes are stored in local time; full UTC conversion with timezone picker is a planned enhancement
- [ ] **PDF export**: Print stylesheet is included; dedicated PDF export via a library like jsPDF is a future enhancement
- [ ] **Real-time updates**: Firestore real-time listeners would allow live score updates without refreshing — straightforward to add with `onSnapshot`
- [ ] **Pool play + knockout**: Multi-phase format (group stage → knockout rounds) is architecturally supported by the data model but not yet in the UI wizard

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push and open a PR

---

## 📄 License

MIT — free to use, modify, and deploy.
