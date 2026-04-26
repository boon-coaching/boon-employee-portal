import { useNavigate } from 'react-router-dom';
import { usePortalData } from './ProtectedLayout';
import { isAlumniState, isPreFirstSession, isPendingReflectionState, isPausedState, isTerminatedState, isInactiveState, isMatchesPresentedState, isDroppedFirstState } from '../lib/coachingState';
import { CompletedProgramHome } from './CompletedProgramHome';
import PreFirstSessionHome from './PreFirstSessionHome';
import PendingReflectionHome from './PendingReflectionHome';
import ScaleHome from './ScaleHome';
import ActiveGrowHome from './ActiveGrowHome';
import GrowDashboard from './GrowDashboard';
import MatchingHome from './MatchingHome';
import InactiveHome from './InactiveHome';
import MatchesPresentedHome from './MatchesPresentedHome';
import DroppedFirstHome from './DroppedFirstHome';

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
  const isInactive = isInactiveState(coachingState.state);
  const isMatchesPresented = isMatchesPresentedState(coachingState.state);
  const isDroppedFirst = isDroppedFirstState(coachingState.state);
  const isScale = coachingState.isScale;

  // MATCHES_PRESENTED: SF generated coach options, user hasn't picked yet
  if (isMatchesPresented) {
    return (
      <MatchesPresentedHome
        profile={profile}
        matchesAreStale={coachingState.matchesAreStale}
        daysSinceMatchEmailSent={coachingState.daysSinceMatchEmailSent}
      />
    );
  }

  // DROPPED_FIRST: Selected coach but no-showed first session, SF flipped to Inactive
  if (isDroppedFirst) {
    return <DroppedFirstHome profile={profile} />;
  }

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
      <div className="max-w-3xl mx-auto space-y-8 md:space-y-12 animate-fade-in pb-32 md:pb-0">
        <header className="text-center pt-2">
          <h1 className="font-display font-bold text-boon-navy text-[36px] md:text-[52px] leading-[1.05] tracking-[-0.025em]">
            Hi {profile?.first_name || 'there'}
          </h1>
          <p className="text-boon-charcoal/55 mt-2 text-lg font-medium">
            Coaching is paused for now
          </p>
        </header>

        <section className="bg-boon-coral/12 rounded-card p-8 md:p-10 border border-boon-charcoal/[0.08]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-btn bg-boon-coral flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
              </svg>
            </div>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-coral">On hold</span>
          </div>
          <h2 className="font-display font-bold text-boon-navy tracking-[-0.02em] leading-[1.15] text-3xl md:text-4xl mb-4">
            Pause now, pick it back <span className="font-serif italic font-normal">up</span> later.
          </h2>
          <p className="text-boon-charcoal/75 text-lg leading-relaxed mb-6">
            Your sessions are paused, not gone. Past notes, progress, and practice scenarios stay open while you take time.
          </p>
          <a
            href="mailto:hello@boon-health.com?subject=Question%20About%20My%20Paused%20Program"
            className="inline-flex items-center gap-2 text-boon-blue font-bold hover:underline"
          >
            Question? Reach out
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </section>

        {completedSessions.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            <button
              onClick={() => navigate('/sessions')}
              className="bg-white p-7 md:p-8 rounded-card border border-boon-charcoal/[0.08] shadow-sm text-left hover:border-boon-blue/30 hover:shadow-md transition-all"
            >
              <p className="text-[11px] font-extrabold text-boon-blue uppercase tracking-[0.18em] mb-2">Session history</p>
              <p className="text-boon-charcoal/75 text-sm">Revisit your {completedSessions.length} session{completedSessions.length !== 1 ? 's' : ''}.</p>
            </button>
            <button
              onClick={() => navigate('/practice')}
              className="bg-white p-7 md:p-8 rounded-card border border-boon-charcoal/[0.08] shadow-sm text-left hover:border-boon-blue/30 hover:shadow-md transition-all"
            >
              <p className="text-[11px] font-extrabold text-boon-blue uppercase tracking-[0.18em] mb-2">Practice space</p>
              <p className="text-boon-charcoal/75 text-sm">Run through scenarios while you wait.</p>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Terminated
  if (isTerminated) {
    return (
      <div className="max-w-3xl mx-auto space-y-8 md:space-y-12 animate-fade-in pb-32 md:pb-0">
        <header className="text-center pt-2">
          <h1 className="font-display font-bold text-boon-navy text-[36px] md:text-[52px] leading-[1.05] tracking-[-0.025em]">
            Hi {profile?.first_name || 'there'}
          </h1>
          <p className="text-boon-charcoal/55 mt-2 text-lg font-medium">
            Your coaching program has wrapped
          </p>
        </header>

        <section className="bg-boon-offWhite rounded-card p-8 md:p-10 border border-boon-charcoal/[0.08]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-btn bg-boon-charcoal/55 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-charcoal/55">Program ended</span>
          </div>
          <h2 className="font-display font-bold text-boon-navy tracking-[-0.02em] leading-[1.15] text-3xl md:text-4xl mb-4">
            Your time with Boon has <span className="font-serif italic font-normal">wrapped</span>.
          </h2>
          <p className="text-boon-charcoal/75 text-lg leading-relaxed mb-6">
            {completedSessions.length > 0
              ? 'Your archive stays open. Sessions, progress, and the practice space are still here when you need them.'
              : 'If something looks off about your status, ping us and we\'ll sort it out.'}
          </p>
          <a
            href="mailto:hello@boon-health.com?subject=Question%20About%20My%20Program"
            className="inline-flex items-center gap-2 text-boon-blue font-bold hover:underline"
          >
            Reach out
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </section>

        {completedSessions.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            <button
              onClick={() => navigate('/sessions')}
              className="bg-white p-7 md:p-8 rounded-card border border-boon-charcoal/[0.08] shadow-sm text-left hover:border-boon-blue/30 hover:shadow-md transition-all"
            >
              <p className="text-[11px] font-extrabold text-boon-blue uppercase tracking-[0.18em] mb-2">Session archive</p>
              <p className="text-boon-charcoal/75 text-sm">Revisit your {completedSessions.length} session{completedSessions.length !== 1 ? 's' : ''}.</p>
            </button>
            <button
              onClick={() => navigate('/practice')}
              className="bg-white p-7 md:p-8 rounded-card border border-boon-charcoal/[0.08] shadow-sm text-left hover:border-boon-blue/30 hover:shadow-md transition-all"
            >
              <p className="text-[11px] font-extrabold text-boon-coral uppercase tracking-[0.18em] mb-2">Practice space</p>
              <p className="text-boon-charcoal/75 text-sm">The leadership toolkit, still here.</p>
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

  // Inactive — has had real sessions, dormant 46-180 days, no upcoming
  if (isInactive) {
    return (
      <InactiveHome
        profile={profile}
        lastSession={coachingState.lastSession}
        daysSinceLastSession={coachingState.daysSinceLastCompletedSession ?? 0}
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
