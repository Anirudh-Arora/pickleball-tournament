import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import NavBar from './components/shared/NavBar';
import ProtectedRoute from './components/shared/ProtectedRoute';
import HomePage from './pages/HomePage';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import DashboardPage from './pages/DashboardPage';
import CreateTournamentPage from './pages/CreateTournamentPage';
import OrganizerPage from './pages/OrganizerPage';
import ParticipantPage from './pages/ParticipantPage';
import './styles/main.css';

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <NavBar />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/tournament/new" element={<ProtectedRoute><CreateTournamentPage /></ProtectedRoute>} />
            <Route path="/organizer/:id" element={<ProtectedRoute><OrganizerPage /></ProtectedRoute>} />
            <Route path="/t/:slug" element={<ParticipantPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </HashRouter>
    </AuthProvider>
  );
}

export default App;
