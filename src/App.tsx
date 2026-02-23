import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Static imports (auth flow, always needed immediately)
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import FeedbackPage from './pages/FeedbackPage';
import WelcomeCompletePage from './pages/WelcomeCompletePage';
import HelpPrivacyPage from './pages/HelpPrivacyPage';
import { ProtectedLayout } from './components/ProtectedLayout';
import { PreviewBanner } from './components/PreviewBanner';

// Lazy-loaded route children (loaded after auth, on demand)
const HomePage = lazy(() => import('./components/HomePage').then(m => ({ default: m.HomePage })));
const SessionsPage = lazy(() => import('./components/Sessions'));
const ProgressPage = lazy(() => import('./components/Progress'));
const Practice = lazy(() => import('./components/Practice'));
const CoachPage = lazy(() => import('./components/Coach'));
const Resources = lazy(() => import('./components/Resources'));
const Settings = lazy(() => import('./components/Settings'));

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center">
        <img
          src="https://res.cloudinary.com/djbo6r080/image/upload/v1764863780/Icon_Blue_10_i8hkao.png"
          className="w-12 h-12 animate-bounce mb-4"
          alt="Loading..."
        />
      </div>
    </div>
  );
}

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
          <Route index element={<Suspense fallback={<PageLoader />}><HomePage /></Suspense>} />
          <Route path="sessions" element={<Suspense fallback={<PageLoader />}><SessionsPage /></Suspense>} />
          <Route path="progress" element={<Suspense fallback={<PageLoader />}><ProgressPage /></Suspense>} />
          <Route path="practice" element={<Suspense fallback={<PageLoader />}><Practice /></Suspense>} />
          <Route path="coach" element={<Suspense fallback={<PageLoader />}><CoachPage /></Suspense>} />
          <Route path="resources" element={<Suspense fallback={<PageLoader />}><Resources /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
          <Route path="feedback" element={<FeedbackPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
