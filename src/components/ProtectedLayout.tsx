import { useEffect, useState } from 'react';
import { Navigate, Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useEmployeeData, type EmployeeData } from '../hooks/useEmployeeData';
import { GoalProvider } from '../hooks/useGoalData';
import NoEmployeeFound from '../pages/NoEmployeeFound';
import WelcomePage from '../pages/WelcomePage';
import Layout from './Layout';
import CheckpointFlow from './CheckpointFlow';
import AdminStatePreview from './AdminStatePreview';
import SurveyModal from './SurveyModal';

export function usePortalData() {
  return useOutletContext<EmployeeData>();
}

export function ProtectedLayout() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const [dataTimedOut, setDataTimedOut] = useState(false);

  const data = useEmployeeData();

  useEffect(() => {
    if (authLoading) {
      setAuthTimedOut(false);
      const timer = setTimeout(() => setAuthTimedOut(true), 15_000);
      return () => clearTimeout(timer);
    }
  }, [authLoading]);

  useEffect(() => {
    if (data.dataLoading) {
      setDataTimedOut(false);
      const timer = setTimeout(() => setDataTimedOut(true), 15_000);
      return () => clearTimeout(timer);
    }
  }, [data.dataLoading]);

  // Auth loading (includes employee profile fetch)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-boon-bg flex items-center justify-center">
        <div className="flex flex-col items-center">
          <img
            src="https://res.cloudinary.com/djbo6r080/image/upload/v1764863780/Icon_Blue_10_i8hkao.png"
            className="w-12 h-12 animate-bounce mb-4"
            alt="Loading..."
          />
          <p className="text-boon-blue font-medium">Loading...</p>
          {authTimedOut && (
            <div className="mt-4 space-y-2 text-center">
              <p className="text-amber-600 text-sm">This is taking longer than expected.</p>
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-2.5 bg-white text-boon-blue border border-boon-blue rounded-xl font-bold text-sm hover:bg-blue-50 transition-all"
              >
                Back to sign in
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // No employee found
  if (!data.employee) {
    return <NoEmployeeFound />;
  }

  // Data fetching error
  if (data.dataError && !data.dataLoading) {
    return (
      <div className="min-h-screen bg-boon-bg flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-sm border border-gray-100">
          <div className="w-14 h-14 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-boon-text mb-2">Something went wrong</h2>
          <p className="text-gray-500 text-sm mb-6">{data.dataError}</p>
          <button
            onClick={data.retryLoadData}
            className="px-6 py-3 bg-boon-blue text-white rounded-xl font-bold text-sm hover:bg-boon-darkBlue transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Data fetching in progress
  if (data.dataLoading) {
    return (
      <div className="min-h-screen bg-boon-bg flex items-center justify-center">
        <div className="flex flex-col items-center">
          <img
            src="https://res.cloudinary.com/djbo6r080/image/upload/v1764863780/Icon_Blue_10_i8hkao.png"
            className="w-12 h-12 animate-bounce mb-4"
            alt="Loading..."
          />
          <p className="text-boon-blue font-medium">Getting your dashboard ready...</p>
          {dataTimedOut && (
            <div className="mt-4 space-y-2 text-center">
              <p className="text-amber-600 text-sm">This is taking longer than expected.</p>
              <button
                onClick={() => data.retryLoadData()}
                className="px-6 py-2.5 bg-white text-boon-blue border border-boon-blue rounded-xl font-bold text-sm hover:bg-blue-50 transition-all"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // NOT_SIGNED_UP: Show welcome page without nav chrome
  if (data.coachingState.state === 'NOT_SIGNED_UP') {
    return (
      <>
        <WelcomePage welcomeSurveyUrl={data.welcomeSurveyLink || import.meta.env.VITE_WELCOME_SURVEY_URL || 'https://boon-health.typeform.com/signup'} />
        <AdminStatePreview
          currentState={data.actualCoachingState.state}
          overrideState={data.stateOverride}
          onStateOverride={data.setStateOverride}
          programType={data.programType}
          programTypeOverride={data.programTypeOverride}
          onProgramTypeOverride={data.setProgramTypeOverride}
        />
      </>
    );
  }

  // Checkpoint completion handler that navigates to /progress
  function handleCheckpointComplete(newCheckpoint: Parameters<typeof data.handleCheckpointComplete>[0]) {
    data.handleCheckpointComplete(newCheckpoint);
    navigate('/progress');
  }

  // Get checkpoint flow data
  const completedSessions = data.sessions.filter(s => s.status === 'Completed');
  const lastSession = completedSessions.length > 0
    ? completedSessions.sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())[0]
    : null;

  return (
    <GoalProvider sessions={data.sessions} actionItems={data.actionItems}>
    <Layout coachingState={data.coachingState}>
      <Outlet context={data} />

      {/* Checkpoint Flow Modal (for SCALE users) */}
      {data.showCheckpointFlow && (() => {
        return (
          <CheckpointFlow
            userEmail={data.employee.company_email || ''}
            employeeId={data.employee.id || ''}
            sessionId={lastSession?.id || ''}
            sessionNumber={data.coachingState.scaleCheckpointStatus.nextCheckpointDueAtSession}
            coachName={lastSession?.coach_name || data.sessions[0]?.coach_name || 'your coach'}
            firstName={data.employee.first_name || null}
            lastName={data.employee.last_name || null}
            companyName={data.employee.company_name || null}
            coachingProgram={data.employee.coaching_program || null}
            companyId={data.employee.company_id || null}
            baselineSatisfaction={data.welcomeSurveyScale?.satisfaction ?? null}
            baselineProductivity={data.welcomeSurveyScale?.productivity ?? null}
            baselineWorkLifeBalance={data.welcomeSurveyScale?.work_life_balance ?? null}
            onComplete={handleCheckpointComplete}
            onClose={() => data.setShowCheckpointFlow(false)}
          />
        );
      })()}

      {/* Native Survey Modal (for pending feedback surveys) */}
      {data.showSurveyModal && data.pendingSurvey && (
        <SurveyModal
          isOpen={data.showSurveyModal}
          surveyType={data.pendingSurvey.survey_type}
          sessionId={data.pendingSurvey.session_id}
          sessionNumber={data.pendingSurvey.session_number}
          coachName={data.pendingSurvey.coach_name}
          userEmail={data.employee.company_email || ''}
          employeeId={data.employee.id}
          onComplete={data.handleSurveyComplete}
        />
      )}

      {/* Admin State Preview Panel */}
      <AdminStatePreview
        currentState={data.actualCoachingState.state}
        overrideState={data.stateOverride}
        onStateOverride={data.setStateOverride}
        programType={data.programType}
        programTypeOverride={data.programTypeOverride}
        onProgramTypeOverride={data.setProgramTypeOverride}
      />
    </Layout>
    </GoalProvider>
  );
}
