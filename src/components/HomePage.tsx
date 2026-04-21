import { useNavigate } from 'react-router-dom';
import { usePortalData } from './ProtectedLayout';
import { isAlumniState, isPreFirstSession, isPendingReflectionState, isPausedState, isTerminatedState } from '../lib/coachingState';
import { CompletedProgramHome } from './CompletedProgramHome';
import PreFirstSessionHome from './PreFirstSessionHome';
import PendingReflectionHome from './PendingReflectionHome';
import ScaleHome from './ScaleHome';
import ActiveGrowHome from './ActiveGrowHome';
import GrowDashboard from './GrowDashboard';
import MatchingHome from './MatchingHome';

export function HomePage() {
  const navigate = useNavigate();
  const data = usePortalData();
  const { employee: profile, effectiveSessions: sessions, effectiveActionItems: actionItems, effectiveBaseline: baseline, welcomeSurveyScale, programType, reloadActionItems: onActionUpdate, coachingState, handleStartReflection, handleStartCheckpoint } = data;
  const userEmail = profile?.company_email || '';

  const completedSessions = sessions.filter(s => s.status === 'Completed');

  const isCompleted = isAlumniState(coachingState.state);
  const isPreFirst = isPreFirstSession(coachingState.state);
  const isPendingReflection = isPendingReflectionState(coachingState.state);
  const isPaused = isPausedState(coachingState.state);
  const isTerminated = isTerminatedState(coachingState.state);
  const isScale = coachingState.isScale;

  // SIGNED_UP_NOT_MATCHED: Show matching home
  if (coachingState.state === 'SIGNED_UP_NOT_MATCHED') {
    return (
      <MatchingHome
        profile={profile}
        baseline={baseline}
        welcomeSurveyScale={welcomeSurveyScale}
        programType={programType}
      />
    );
  }

  // Paused
  if (isPaused) {
    return (
      <div className="max-w-3xl mx-auto space-y-8 md:space-y-12 animate-fade-in">
        <header className="text-center pt-2">
          <h1 className="font-display font-bold text-boon-navy text-[36px] md:text-[52px] leading-[1.05] tracking-[-0.025em]">
            Hi {profile?.first_name || 'there'}
          </h1>
          <p className="text-boon-charcoal/55 mt-2 text-lg font-medium">
            Your coaching is currently paused
          </p>
        </header>

        <section className="bg-boon-warning/12 rounded-card p-8 md:p-10 border border-boon-charcoal/[0.08]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-btn bg-boon-warning flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-warning">On Hold</span>
          </div>
          <h2 className="font-display font-bold text-boon-navy tracking-[-0.02em] leading-[1.15] text-2xl md:text-3xl mb-4">
            Your coaching program is paused
          </h2>
          <p className="text-boon-charcoal/75 text-lg leading-relaxed mb-6">
            Your sessions are temporarily on hold. You can still review your past sessions, progress, and practice scenarios while you wait.
          </p>
          <a
            href="mailto:hello@boon-health.com?subject=Question%20About%20My%20Paused%20Program"
            className="inline-flex items-center gap-2 text-boon-warning font-bold hover:underline"
          >
            Questions? Contact Boon Support
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </section>

        {completedSessions.length > 0 && (
          <div className="grid md:grid-cols-2 gap-8">
            <button
              onClick={() => navigate('/sessions')}
              className="bg-white p-8 rounded-card border border-boon-charcoal/[0.08] shadow-sm text-left hover:border-boon-blue/20 transition-all"
            >
              <p className="text-[11px] font-extrabold text-boon-blue uppercase tracking-[0.18em] mb-2">Session History</p>
              <p className="text-boon-charcoal/75 text-sm">{completedSessions.length} completed session{completedSessions.length !== 1 ? 's' : ''}</p>
            </button>
            <button
              onClick={() => navigate('/practice')}
              className="bg-white p-8 rounded-card border border-boon-charcoal/[0.08] shadow-sm text-left hover:border-boon-blue/20 transition-all"
            >
              <p className="text-[11px] font-extrabold text-boon-purple uppercase tracking-[0.18em] mb-2">Practice Space</p>
              <p className="text-boon-charcoal/75 text-sm">Continue practicing leadership scenarios</p>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Terminated
  if (isTerminated) {
    return (
      <div className="max-w-3xl mx-auto space-y-8 md:space-y-12 animate-fade-in">
        <header className="text-center pt-2">
          <h1 className="font-display font-bold text-boon-navy text-[36px] md:text-[52px] leading-[1.05] tracking-[-0.025em]">
            Hi {profile?.first_name || 'there'}
          </h1>
          <p className="text-boon-charcoal/55 mt-2 text-lg font-medium">
            Your coaching program has ended
          </p>
        </header>

        <section className="bg-boon-offWhite rounded-card p-8 md:p-10 border border-boon-charcoal/[0.08]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-btn bg-boon-charcoal/55 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-charcoal/55">Program Ended</span>
          </div>
          <h2 className="font-display font-bold text-boon-navy tracking-[-0.02em] leading-[1.15] text-2xl md:text-3xl mb-4">
            Your coaching program has concluded
          </h2>
          <p className="text-boon-charcoal/75 text-lg leading-relaxed mb-6">
            {completedSessions.length > 0
              ? 'You can still access your session history and practice space below.'
              : 'If you have questions about your program status, please reach out to us.'}
          </p>
          <a
            href="mailto:hello@boon-health.com?subject=Question%20About%20My%20Program"
            className="inline-flex items-center gap-2 text-boon-blue font-bold hover:underline"
          >
            Contact Boon Support
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </section>

        {completedSessions.length > 0 && (
          <div className="grid md:grid-cols-2 gap-8">
            <button
              onClick={() => navigate('/sessions')}
              className="bg-white p-8 rounded-card border border-boon-charcoal/[0.08] shadow-sm text-left hover:border-boon-blue/20 transition-all"
            >
              <p className="text-[11px] font-extrabold text-boon-blue uppercase tracking-[0.18em] mb-2">Session Archive</p>
              <p className="text-boon-charcoal/75 text-sm">{completedSessions.length} completed session{completedSessions.length !== 1 ? 's' : ''}</p>
            </button>
            <button
              onClick={() => navigate('/practice')}
              className="bg-white p-8 rounded-card border border-boon-charcoal/[0.08] shadow-sm text-left hover:border-boon-blue/20 transition-all"
            >
              <p className="text-[11px] font-extrabold text-boon-purple uppercase tracking-[0.18em] mb-2">Practice Space</p>
              <p className="text-boon-charcoal/75 text-sm">Continue practicing leadership scenarios</p>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Pre-first-session
  if (isPreFirst) {
    return (
      <PreFirstSessionHome
        profile={profile}
        sessions={sessions}
        baseline={baseline}
        welcomeSurveyScale={welcomeSurveyScale}
        programType={programType}
        userEmail={userEmail}
      />
    );
  }

  // Pending reflection (GROW/EXEC)
  if (isPendingReflection) {
    return (
      <PendingReflectionHome
        profile={profile}
        sessions={sessions}
        baseline={baseline}
        programType={programType}
        onStartReflection={handleStartReflection}
      />
    );
  }

  // SCALE users
  if (isScale && !isCompleted) {
    return (
      <ScaleHome
        profile={profile}
        sessions={sessions}
        actionItems={actionItems}
        baseline={baseline}
        welcomeSurveyScale={welcomeSurveyScale}
        checkpointStatus={coachingState.scaleCheckpointStatus}
        onActionUpdate={onActionUpdate}
        userEmail={userEmail}
        onStartCheckpoint={handleStartCheckpoint}
      />
    );
  }

  // Active GROW users
  if (!isCompleted && coachingState.isGrowOrExec && programType === 'GROW') {
    return (
      <GrowDashboard
        profile={profile}
        sessions={sessions}
        actionItems={actionItems}
        baseline={baseline}
        welcomeSurveyScale={welcomeSurveyScale}
        coachingState={coachingState}
        onActionUpdate={onActionUpdate}
        userEmail={userEmail}
        programType={programType}
      />
    );
  }

  // Active EXEC / unknown / legacy
  if (!isCompleted) {
    return (
      <ActiveGrowHome
        profile={profile}
        sessions={sessions}
        actionItems={actionItems}
        baseline={baseline}
        coachingState={coachingState}
        onActionUpdate={onActionUpdate}
        userEmail={userEmail}
      />
    );
  }

  // Completed program
  return <CompletedProgramHome />;
}
