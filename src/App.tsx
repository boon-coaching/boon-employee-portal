import { Component, lazy, Suspense, type ReactNode } from 'react';
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

// Catches lazy chunk load failures (network errors, CDN timeouts)
// and shows a retry UI instead of a white screen
interface ChunkErrorBoundaryProps {
  children: ReactNode;
}

interface ChunkErrorBoundaryState {
  hasError: boolean;
}

class ChunkErrorBoundary extends Component<ChunkErrorBoundaryProps, ChunkErrorBoundaryState> {
  state: ChunkErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-boon-text font-medium mb-2">Page failed to load.</p>
            <p className="text-gray-500 text-sm mb-4">This is usually a network issue.</p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="px-6 py-2.5 bg-boon-blue text-white rounded-xl font-bold text-sm hover:bg-boon-darkBlue transition-all"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function LazyPage({ children }: { children: ReactNode }) {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </ChunkErrorBoundary>
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
          <Route index element={<LazyPage><HomePage /></LazyPage>} />
          <Route path="sessions" element={<LazyPage><SessionsPage /></LazyPage>} />
          <Route path="progress" element={<LazyPage><ProgressPage /></LazyPage>} />
          <Route path="practice" element={<LazyPage><Practice /></LazyPage>} />
          <Route path="coach" element={<LazyPage><CoachPage /></LazyPage>} />
          <Route path="resources" element={<LazyPage><Resources /></LazyPage>} />
          <Route path="settings" element={<LazyPage><Settings /></LazyPage>} />
          <Route path="feedback" element={<FeedbackPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
