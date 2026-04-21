import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Employee, Session, ActionItem, BaselineSurvey, WelcomeSurveyScale, Coach } from '../lib/types';
import type { ScaleCheckpointStatus } from '../lib/types';
import type { ProgramConfig } from '../lib/dataFetcher';
import { updateActionItemStatus, fetchCoachByName } from '../lib/dataFetcher';
import { isUpcomingSession } from '../lib/coachingState';
import SessionPrep from './SessionPrep';
import { PracticePrompt } from './PracticePrompt';
import { MilestoneCelebration } from './MilestoneCelebration';
import { JournalPromptCard } from './journal/JournalPromptCard';

interface ScaleHomeProps {
  profile: Employee | null;
  sessions: Session[];
  actionItems: ActionItem[];
  baseline: BaselineSurvey | null;
  welcomeSurveyScale?: WelcomeSurveyScale | null;
  checkpointStatus: ScaleCheckpointStatus;
  onActionUpdate: () => void;
  userEmail: string;
  onStartCheckpoint?: () => void;
  onDismissCheckpoint?: () => void;
  programConfig?: ProgramConfig | null;
  contractPeriodSessions?: Session[] | null;
}

export default function ScaleHome({
  profile,
  sessions,
  actionItems,
  baseline: _baseline,
  welcomeSurveyScale: _welcomeSurveyScale,
  checkpointStatus,
  onActionUpdate,
  userEmail,
  onStartCheckpoint,
  onDismissCheckpoint,
  programConfig,
  contractPeriodSessions,
}: ScaleHomeProps) {
  // Unused props reserved for future use
  void _baseline;
  void _welcomeSurveyScale;

  const [updatingItem, setUpdatingItem] = useState<string | null>(null);
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);

  const completedSessions = sessions
    .filter(s => s.status === 'Completed')
    .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

  // Session progress for PEPM clients with session caps
  const sessionCap = programConfig?.sessions_per_employee ?? null;
  const contractSessionCount = contractPeriodSessions !== null && contractPeriodSessions !== undefined
    ? contractPeriodSessions.length
    : completedSessions.length;
  const showSessionProgress = sessionCap !== null && sessionCap > 0;

  // Get the NEAREST upcoming session (sort by date ascending, take first)
  const upcomingSession = sessions
    .filter(isUpcomingSession)
    .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())[0] || null;
  const lastSession = completedSessions.length > 0 ? completedSessions[0] : null;

  // Calculate days since last session for urgency messaging
  const daysSinceLastSession = lastSession
    ? Math.floor((Date.now() - new Date(lastSession.session_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Find most recent session with goals or plan (for "Where You Left Off")
  const sessionWithGoals = completedSessions.find(s => s.goals || s.plan) || null;

  // Get current focus from latest checkpoint
  const currentFocus = checkpointStatus.latestCheckpoint?.focus_area;

  const coachName = completedSessions[0]?.coach_name || upcomingSession?.coach_name || null;

  // Fetch coach profile for the compact card
  useEffect(() => {
    if (coachName && coachName !== 'Your Coach') {
      fetchCoachByName(coachName).then(c => setCoachProfile(c));
    }
  }, [coachName]);
  const coachPhotoUrl = coachProfile?.photo_url || null;

  // Toggle action item status
  async function handleToggleAction(itemId: string, currentStatus: string) {
    setUpdatingItem(itemId);
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    const success = await updateActionItemStatus(itemId, newStatus);
    if (success) {
      onActionUpdate();
    }
    setUpdatingItem(null);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 md:space-y-12 animate-fade-in">

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-2">
        <div className="text-center sm:text-left">
          <h1 className="font-display font-bold text-boon-navy text-[36px] md:text-[52px] leading-[1.05] tracking-[-0.025em]">
            Hi {profile?.first_name || 'there'}
          </h1>
          <p className="text-boon-charcoal/55 mt-2 text-lg font-medium">
            This is your personal coaching space.
          </p>
        </div>
      </header>

      {/* Session Milestone Celebration */}
      <MilestoneCelebration
        completedSessionCount={completedSessions.length}
        programType="SCALE"
        totalExpected={6}
        userEmail={userEmail}
      />

      {/* GoalHomeCard removed: action items were duplicated */}

      {/* Coach Card - compact inline */}
      {coachName && (
        <section className="bg-white rounded-card p-5 border border-boon-charcoal/[0.08] shadow-sm">
          <div className="flex items-center gap-4">
            {coachPhotoUrl ? (
              <img
                src={coachPhotoUrl}
                alt={coachName}
                className="w-12 h-12 rounded-pill object-cover border-2 border-white shadow"
              />
            ) : (
              <div className="w-12 h-12 rounded-pill bg-boon-lightBlue flex items-center justify-center border-2 border-white shadow">
                <span className="text-boon-blue text-sm font-bold">
                  {coachName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-boon-navy text-sm">{coachName}</p>
              {coachProfile?.headline && (
                <p className="text-xs text-boon-charcoal/55 truncate">{coachProfile.headline}</p>
              )}
              <p className="text-xs text-boon-charcoal/55">{completedSessions.length} {completedSessions.length === 1 ? 'session' : 'sessions'} together</p>
            </div>
            <Link
              to="/coach"
              className="text-xs font-semibold text-boon-blue hover:text-boon-darkBlue transition-colors flex-shrink-0"
            >
              View profile
            </Link>
          </div>
        </section>
      )}

      {/* Session Progress - PEPM clients with session caps */}
      {showSessionProgress && (
        <section className="bg-white rounded-card p-6 border border-boon-charcoal/[0.08] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-btn bg-boon-lightBlue flex items-center justify-center">
                <svg className="w-5 h-5 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-boon-navy">
                  Session {Math.min(contractSessionCount, sessionCap!)} of {sessionCap}
                </p>
                {programConfig?.program_end_date && (
                  <p className="text-xs text-boon-charcoal/55">
                    Through {new Date(programConfig.program_end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
            {contractSessionCount >= sessionCap! && (
              <span className="text-xs font-bold text-boon-success bg-boon-success/10 px-3 py-1 rounded-pill">
                Complete
              </span>
            )}
          </div>
          <div className="w-full bg-boon-offWhite rounded-pill h-2.5">
            <div
              className={`h-2.5 rounded-pill transition-all duration-500 ${
                contractSessionCount >= sessionCap! ? 'bg-boon-success' : 'bg-boon-blue'
              }`}
              style={{ width: `${Math.min((contractSessionCount / sessionCap!) * 100, 100)}%` }}
            />
          </div>
        </section>
      )}

      {/* 1. Session Prep - FIRST when there's an upcoming session */}
      {upcomingSession && (
        <SessionPrep
          sessions={sessions}
          actionItems={actionItems}
          coachName={lastSession?.coach_name || 'Your Coach'}
          userEmail={userEmail}
          onActionUpdate={onActionUpdate}
        />
      )}

      {/* 2. Ready for your next session - Book CTA when no upcoming session */}
      {!upcomingSession && profile?.booking_link && (
        <a
          href={profile.booking_link}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-gradient-to-br from-boon-lightBlue/30 to-white rounded-card p-6 border-2 border-boon-blue/20 hover:border-boon-blue/40 transition-all group"
        >
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-boon-lightBlue rounded-card flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              {daysSinceLastSession > 21 && (
                <p className="text-boon-warning text-sm font-medium mb-3">
                  It's been {daysSinceLastSession} days since your last session. Book your next one to keep your momentum going.
                </p>
              )}
              <h2 className="text-xl font-extrabold text-boon-navy group-hover:text-boon-blue transition-colors">
                Ready for your next session?
              </h2>
              <p className="text-boon-charcoal/55 mt-1">
                Continue your coaching journey with {lastSession?.coach_name?.split(' ')[0] || 'your coach'}.
              </p>
            </div>
            <svg className="w-6 h-6 text-boon-blue opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </a>
      )}

      {/* Checkpoint Prompt - Prominent when due */}
      {checkpointStatus.isCheckpointDue && onStartCheckpoint && (
        <section className="bg-boon-purple/10 rounded-card p-8 border border-boon-charcoal/[0.08] relative overflow-hidden">
          <div className="absolute inset-0 opacity-5">
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-boon-purple rounded-pill" />
            <div className="absolute -left-8 -bottom-8 w-48 h-48 bg-boon-purple rounded-pill" />
          </div>
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-boon-purple/20 rounded-card flex items-center justify-center">
                    <svg className="w-6 h-6 text-boon-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold text-boon-purple uppercase tracking-widest">
                    {checkpointStatus.currentCheckpointNumber === 1
                      ? (completedSessions.length > 6 ? 'Check-in due' : 'First check-in')
                      : `Check-in ${checkpointStatus.currentCheckpointNumber}`}
                  </span>
                </div>
                <h2 className="text-2xl font-extrabold text-boon-navy mb-2">
                  {checkpointStatus.currentCheckpointNumber === 1
                    ? (completedSessions.length > 6
                      ? 'Time for a check-in'
                      : 'Time for your first check-in')
                    : `${checkpointStatus.nextCheckpointDueAtSession} sessions in. See what's shifted.`}
                </h2>
                <p className="text-boon-charcoal/75 mb-6">
                  {checkpointStatus.currentCheckpointNumber === 1
                    ? (completedSessions.length > 6
                      ? 'Take 2 minutes to reflect on your coaching journey so far.'
                      : 'Establish your baseline and start tracking your evolution over time.')
                    : 'Take 2 minutes to reflect on your progress and set your focus.'}
                </p>
                <button
                  onClick={onStartCheckpoint}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-boon-purple text-white font-bold rounded-card hover:bg-boon-purple/90 transition-all shadow-sm active:scale-95"
                >
                  Start Check-In
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              {onDismissCheckpoint && (
                <button
                  onClick={onDismissCheckpoint}
                  className="p-2 text-boon-charcoal/55 hover:text-boon-charcoal/75 transition-colors"
                  title="Remind me later"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 3. Where You Left Off - ONLY when no upcoming session (otherwise redundant with SessionPrep) */}
      {!upcomingSession && (
        currentFocus ? (
          <section className="bg-boon-offWhite rounded-card p-8 border border-boon-charcoal/[0.08]">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-extrabold text-boon-navy">Current Focus</h2>
              <span className="text-[10px] font-bold text-boon-charcoal/55 uppercase tracking-widest">
                From check-in {checkpointStatus.latestCheckpoint?.checkpoint_number}
              </span>
            </div>
            <div className="prose prose-sm max-w-none">
              <div className="text-boon-charcoal/75 leading-relaxed">
                {currentFocus}
              </div>
            </div>
          </section>
        ) : (sessionWithGoals || actionItems.length > 0) ? (
          <section className="bg-gradient-to-br from-boon-amberLight/30 to-white rounded-card p-8 border border-boon-amber/20">
            <div className="flex items-start justify-between mb-6">
              <h2 className="text-sm font-bold text-boon-amber uppercase tracking-widest">Where You Left Off</h2>
              {sessionWithGoals && (
                <span className="text-xs font-medium text-boon-charcoal/55">
                  {new Date(sessionWithGoals.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>

            {/* Goals */}
            {sessionWithGoals?.goals && (
              <div className="mb-6">
                <h3 className="text-xs font-bold text-boon-charcoal/55 uppercase tracking-wider mb-3">Goals</h3>
                <p className="font-serif text-boon-charcoal/75 leading-relaxed whitespace-pre-line">{sessionWithGoals.goals}</p>
              </div>
            )}

            {/* Action Items - primary source: action_items table */}
            {actionItems.length > 0 ? (
              <div>
                <h3 className="text-xs font-bold text-boon-charcoal/55 uppercase tracking-wider mb-3">Action Items</h3>
                <div className="space-y-2">
                  {actionItems.map(item => {
                    const isCompleted = item.status === 'completed';
                    const isUpdating = updatingItem === item.id;

                    return (
                      <label
                        key={item.id}
                        className={`flex items-start gap-3 p-3 rounded-btn cursor-pointer transition-all ${
                          isCompleted
                            ? 'bg-boon-success/10 text-boon-charcoal/55'
                            : 'bg-white/60 hover:bg-white text-boon-charcoal/75'
                        } ${isUpdating ? 'opacity-50' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          disabled={isUpdating}
                          onChange={() => handleToggleAction(item.id, item.status)}
                          className="mt-0.5 w-4 h-4 rounded border-boon-charcoal/[0.08] text-boon-amber focus:ring-boon-amber disabled:opacity-50"
                        />
                        <span className={`text-sm leading-relaxed ${isCompleted ? 'line-through' : ''}`}>
                          {item.action_text}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : sessionWithGoals?.plan ? (
              /* Fallback: parse plan text only when no action_items exist */
              <div>
                <h3 className="text-xs font-bold text-boon-charcoal/55 uppercase tracking-wider mb-3">Action Items</h3>
                <div className="space-y-2">
                  {sessionWithGoals.plan.split(/[\n;]/).filter(line => line.trim()).map((item, idx) => {
                    const cleanText = item.trim().replace(/^[\s•\-\*\d\.:\)]+/, '').trim();
                    if (!cleanText || cleanText.length < 5) return null;

                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 rounded-btn bg-white/60 text-boon-charcoal/75"
                      >
                        <div className="mt-0.5 w-4 h-4 rounded border border-boon-charcoal/[0.08] flex-shrink-0" />
                        <span className="text-sm leading-relaxed">{cleanText}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>
        ) : null
      )}

      {/* Journal Prompt */}
      <JournalPromptCard compact />

      {/* Practice Prompt */}
      <PracticePrompt />

      {/* Full coach profile is now at /coach; compact card shown above */}
    </div>
  );
}
