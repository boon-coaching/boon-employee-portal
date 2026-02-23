import { Navigate, Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useEmployeeData, type EmployeeData } from '../hooks/useEmployeeData';
import NoEmployeeFound from '../pages/NoEmployeeFound';
import WelcomePage from '../pages/WelcomePage';
import Layout from './Layout';
import ReflectionFlow from './ReflectionFlow';
import CheckpointFlow from './CheckpointFlow';
import AdminStatePreview from './AdminStatePreview';
import SurveyModal from './SurveyModal';

const WELCOME_SURVEY_URL = import.meta.env.VITE_WELCOME_SURVEY_URL || 'https://boon.typeform.com/welcome';

export function usePortalData() {
  return useOutletContext<EmployeeData>();
}

export function ProtectedLayout() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const data = useEmployeeData();

  // Auth loading
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
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Auth loaded but loading employee data
  if (data.loading) {
    return (
      <div className="min-h-screen bg-boon-bg flex items-center justify-center">
        <div className="flex flex-col items-center">
          <img
            src="https://res.cloudinary.com/djbo6r080/image/upload/v1764863780/Icon_Blue_10_i8hkao.png"
            className="w-12 h-12 animate-bounce mb-4"
            alt="Loading..."
          />
          <p className="text-boon-blue font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // No employee found
  if (!data.employee) {
    return <NoEmployeeFound />;
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
        </div>
      </div>
    );
  }

  // NOT_SIGNED_UP: Show welcome page without nav chrome
  if (data.coachingState.state === 'NOT_SIGNED_UP') {
    return (
      <>
        <WelcomePage welcomeSurveyUrl={WELCOME_SURVEY_URL} />
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

  // Reflection completion handler that navigates to /progress
  function handleReflectionComplete(newReflection: Parameters<typeof data.handleReflectionComplete>[0]) {
    data.handleReflectionComplete(newReflection);
    navigate('/progress');
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
    <Layout coachingState={data.coachingState}>
      <Outlet context={data} />

      {/* Reflection Flow Modal */}
      {data.showReflectionFlow && (
        <ReflectionFlow
          userEmail={data.employee.company_email || ''}
          baseline={data.baseline}
          onComplete={handleReflectionComplete}
          onClose={() => data.setShowReflectionFlow(false)}
        />
      )}

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
  );
}
