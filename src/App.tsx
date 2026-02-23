import { Routes, Route, Navigate } from 'react-router-dom';

// Pages
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import FeedbackPage from './pages/FeedbackPage';
import WelcomeCompletePage from './pages/WelcomeCompletePage';
import HelpPrivacyPage from './pages/HelpPrivacyPage';

// Layout + child routes
import { ProtectedLayout } from './components/ProtectedLayout';
import { HomePage } from './components/HomePage';
import SessionsPage from './components/Sessions';
import ProgressPage from './components/Progress';
import Practice from './components/Practice';
import Resources from './components/Resources';
import CoachPage from './components/Coach';
import Settings from './components/Settings';
import { PreviewBanner } from './components/PreviewBanner';

export default function App() {
  return (
    <>
      <PreviewBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/welcome-complete" element={<WelcomeCompletePage />} />
        <Route path="/help/privacy" element={<HelpPrivacyPage />} />
        <Route element={<ProtectedLayout />}>
          <Route index element={<HomePage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="practice" element={<Practice />} />
          <Route path="coach" element={<CoachPage />} />
          <Route path="resources" element={<Resources />} />
          <Route path="settings" element={<Settings />} />
          <Route path="feedback" element={<FeedbackPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
