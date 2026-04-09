import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { Employee, Session, ActionItem, Coach, BaselineSurvey, WelcomeSurveyScale } from '../lib/types';

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};
import type { CoachingStateData } from '../lib/coachingState';
import { COUNTED_SESSION_STATUSES, isUpcomingSession } from '../lib/coachingState';
import { WeeklyCommitmentSection } from './goals/WeeklyCommitmentSection';
import { PracticePrompt } from './PracticePrompt';
import type { ProgramInfo, GrowFocusArea } from '../lib/dataFetcher';
import { fetchCoachByName, fetchCoachById, fetchProgramInfo, fetchGrowFocusAreas, updateActionItemStatus } from '../lib/dataFetcher';
import CompetencyProgressCard from './CompetencyProgressCard';
import SessionPrep from './SessionPrep';
import { MilestoneCelebration } from './MilestoneCelebration';
import { JournalPromptCard } from './journal/JournalPromptCard';

interface GrowDashboardProps {
  profile: Employee | null;
  sessions: Session[];
  actionItems: ActionItem[];
  baseline: BaselineSurvey | null;
  welcomeSurveyScale?: WelcomeSurveyScale | null;
  coachingState: CoachingStateData;
  onActionUpdate: () => void;
  userEmail: string;
  programType?: string | null;
}

export default function GrowDashboard({
  profile,
  sessions,
  actionItems,
  coachingState,
  onActionUpdate,
  userEmail,
  programType,
}: GrowDashboardProps) {
  const [updatingActionId, setUpdatingActionId] = useState<string | null>(null);

  const completedSessions = sessions
    .filter(s => s.status === 'Completed')
    .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());
  // Get the NEAREST upcoming session (sort by date ascending, take first)
  const upcomingSession = sessions
    .filter(isUpcomingSession)
    .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())[0] || null;
  const lastSession = completedSessions.length > 0 ? completedSessions[0] : null;

  // Calculate days since last session for urgency messaging
  const daysSinceLastSession = lastSession
    ? Math.floor((Date.now() - new Date(lastSession.session_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const coachName = lastSession?.coach_name || upcomingSession?.coach_name || 'Your Coach';
  const coachFirstName = coachName.split(' ')[0];

  // GROW-specific state
  const [programInfo, setProgramInfo] = useState<ProgramInfo | null>(null);
  const [focusAreas, setFocusAreas] = useState<GrowFocusArea[]>([]);
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);

  // Load GROW-specific data
  useEffect(() => {
    const loadGrowData = async () => {
      // Only require userEmail - profile.coaching_program may be null if derived from session
      if (!userEmail) return;

      devLog('[GrowDashboard] Loading data for:', { userEmail, coachName, coachId: profile?.coach_id, program: profile?.coaching_program });

      // Fetch program info and focus areas in parallel (program info is optional)
      const [progInfo, areas] = await Promise.all([
        profile?.coaching_program ? fetchProgramInfo(profile.coaching_program) : Promise.resolve(null),
        fetchGrowFocusAreas(userEmail),
      ]);

      // Try to fetch coach by ID first (more reliable), then fall back to name
      let coach: Coach | null = null;
      if (profile?.coach_id) {
        coach = await fetchCoachById(profile.coach_id);
        devLog('[GrowDashboard] Coach fetch by ID result:', {
          coachId: profile.coach_id,
          coachFound: !!coach,
          coachPhotoUrl: coach?.photo_url
        });
      }

      // Fall back to name lookup if ID lookup didn't work
      if (!coach && coachName !== 'Your Coach') {
        coach = await fetchCoachByName(coachName);
        devLog('[GrowDashboard] Coach fetch by name result:', {
          coachName,
          coachFound: !!coach,
          coachPhotoUrl: coach?.photo_url
        });
      }

      devLog('[GrowDashboard] Final coach result:', {
        coachName,
        coachFound: !!coach,
        coachPhotoUrl: coach?.photo_url,
        fullCoachData: coach
      });

      if (progInfo) setProgramInfo(progInfo);
      if (areas) setFocusAreas(areas);
      if (coach) setCoachProfile(coach as Coach);
    };

    loadGrowData();
  }, [profile?.coaching_program, profile?.coach_id, userEmail, coachName]);

  // Count sessions with this specific coach (includes late cancel, no-show)
  const sessionsWithCoach = sessions.filter(s =>
    COUNTED_SESSION_STATUSES.includes(s.status) && s.coach_name === coachName
  );
  const sessionCountWithCoach = sessionsWithCoach.length;

  const getCoachPhotoUrl = () => coachProfile?.photo_url || null;

  // Action items for "Things You're Working On"
  const pendingActions = actionItems.filter(a => a.status === 'pending');
  // Show recently completed items (last 7 days) with strikethrough
  const recentlyCompletedActions = actionItems.filter(a => {
    if (a.status !== 'completed') return false;
    if (!a.completed_at) return false;
    const completedDate = new Date(a.completed_at);
    const daysSinceCompletion = (Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCompletion <= 7;
  });

  // Debug: Log action items
  devLog('[GrowDashboard] Action items:', {
    totalReceived: actionItems.length,
    pendingCount: pendingActions.length,
    allItems: actionItems,
    completedSessionsCount: completedSessions.length
  });

  // Handle completing an action item
  async function handleCompleteAction(itemId: string) {
    setUpdatingActionId(itemId);
    const success = await updateActionItemStatus(itemId, 'completed');
    if (success) {
      toast.success('Action item completed');
      onActionUpdate();
    } else {
      toast.error('Could not update action item');
    }
    setUpdatingActionId(null);
  }

  const hasUpcomingSession = !!upcomingSession;

  const [prepExpanded, setPrepExpanded] = useState(false);

  return (
    <div className="max-w-3xl mx-auto space-y-6 md:space-y-8 animate-fade-in">
      {/* Header with inline progress */}
      <header className="pt-2">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-boon-text tracking-tight">
              Hi {profile?.first_name || 'there'}
            </h1>
          </div>
          {/* Compact program progress inline */}
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-boon-blue">Session {coachingState.completedSessionCount || 0} of {programInfo?.sessions_per_employee || 12}</p>
            <div className="w-24 h-1.5 bg-gray-100 rounded-full mt-1">
              <div className="h-full bg-boon-blue rounded-full transition-all" style={{ width: `${Math.min(((coachingState.completedSessionCount || 0) / (programInfo?.sessions_per_employee || 12)) * 100, 100)}%` }} />
            </div>
          </div>
        </div>
        {/* Milestone inline */}
        <MilestoneCelebration
          completedSessionCount={completedSessions.length}
          programType={programType === 'EXEC' ? 'EXEC' : 'GROW'}
          totalExpected={12}
          userEmail={userEmail}
        />
      </header>

      {/* GoalHomeCard removed: action items were duplicated in Where We Left Off */}

      {/* Session: upcoming (collapsible prep) or booking CTA */}
      {hasUpcomingSession ? (
        <section className="bg-white rounded-[2rem] border border-gray-100 shadow-sm">
          <button
            onClick={() => setPrepExpanded(!prepExpanded)}
            className="w-full flex items-center justify-between p-5 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-boon-blue flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-boon-text text-sm">Session with {coachFirstName}</p>
                <p className="text-xs text-gray-500">
                  {new Date(upcomingSession!.session_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at {new Date(upcomingSession!.session_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {upcomingSession?.zoom_join_link && (() => {
                const sessionTime = new Date(upcomingSession.session_date).getTime();
                const hoursUntil = (sessionTime - Date.now()) / (1000 * 60 * 60);
                return hoursUntil <= 24 && hoursUntil > -1 ? (
                  <a
                    href={upcomingSession.zoom_join_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-all"
                  >
                    Join
                  </a>
                ) : null;
              })()}
              <svg className={`w-5 h-5 text-gray-400 transition-transform ${prepExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          {prepExpanded && (
            <div className="px-5 pb-5 border-t border-gray-100">
              <SessionPrep
                sessions={sessions}
                actionItems={actionItems}
                coachName={coachName}
                userEmail={userEmail}
                onActionUpdate={onActionUpdate}
              />
            </div>
          )}
        </section>
      ) : (
        <section className="bg-white rounded-[2rem] p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-boon-text text-sm">No upcoming session</p>
                {daysSinceLastSession > 21 && (
                  <p className="text-xs text-amber-600">{daysSinceLastSession} days since last session</p>
                )}
              </div>
            </div>
            {profile?.booking_link && (
              <a
                href={profile.booking_link}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-boon-blue text-white text-sm font-bold rounded-xl hover:bg-boon-darkBlue transition-all"
              >
                Book
              </a>
            )}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          FOCUS AREAS / WHERE WE LEFT OFF - Depends on session completion
          Only show when no upcoming session (SessionPrep handles this otherwise)
          ═══════════════════════════════════════════════════════════════════ */}
      {!hasUpcomingSession && (
        completedSessions.length === 0 ? (
          // Pre-first session: Show baseline focus areas
          <CompetencyProgressCard focusAreas={focusAreas} />
        ) : (
          // Post-first session: Show where we left off (goals + action items)
          <section className="bg-gradient-to-br from-boon-amberLight/50 to-white rounded-[2rem] p-8 border border-boon-amber/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-boon-amber/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-boon-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h2 className="text-sm font-bold text-boon-amber uppercase tracking-widest">Where We Left Off</h2>
            </div>

            {/* Current Goal from last session */}
            {lastSession?.goals && (
              <div className="mb-6 p-5 bg-white/60 rounded-xl border border-boon-amber/10">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Current Goal</p>
                <p style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }} className="text-lg text-boon-text leading-relaxed">
                  {lastSession.goals}
                </p>
              </div>
            )}

            {/* Action Items */}
            {(pendingActions.length > 0 || recentlyCompletedActions.length > 0) ? (
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Action Items</p>
                {/* Pending Items */}
                {pendingActions.map((action) => {
                  const isUpdating = updatingActionId === action.id;
                  return (
                    <div
                      key={action.id}
                      className={`p-4 bg-white/60 rounded-xl border border-boon-amber/10 flex items-start gap-3 ${isUpdating ? 'opacity-50' : ''}`}
                    >
                      <button
                        onClick={() => handleCompleteAction(action.id)}
                        disabled={isUpdating}
                        className="mt-1 w-5 h-5 rounded-full border-2 border-gray-300 hover:border-boon-blue hover:bg-boon-blue/10 transition-all flex-shrink-0 flex items-center justify-center group"
                        title="Mark as complete"
                      >
                        <svg className="w-2.5 h-2.5 text-transparent group-hover:text-boon-blue transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <div className="flex-1">
                        <p style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }} className="text-gray-700 leading-relaxed">{action.action_text}</p>
                        <span className="text-xs text-gray-400 mt-2 block">
                          From {new Date(action.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {/* Recently Completed Items - with strikethrough */}
                {recentlyCompletedActions.map((action) => (
                  <div
                    key={action.id}
                    className="p-4 bg-green-50/50 rounded-xl border border-green-200/30 flex items-start gap-3"
                  >
                    <div className="mt-1 w-5 h-5 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }} className="text-gray-400 leading-relaxed line-through">{action.action_text}</p>
                      <span className="text-xs text-green-600 mt-2 block">
                        Completed {action.completed_at ? new Date(action.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'recently'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : !lastSession?.goals && (
              <p className="text-gray-500 text-sm italic">
                Your goals and action items from coaching sessions will appear here.
              </p>
            )}

            {/* Weekly commitment + check-in */}
            <WeeklyCommitmentSection />
          </section>
        )
      )}

      {/* Between sessions: coach + journal + practice in one container */}
      <section className="bg-white rounded-[2rem] p-5 border border-gray-100 shadow-sm divide-y divide-gray-100">
        {/* Coach row */}
        <div className="flex items-center gap-3 pb-4">
          {getCoachPhotoUrl() ? (
            <img src={getCoachPhotoUrl()!} alt={coachName} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-boon-lightBlue flex items-center justify-center">
              <span className="text-boon-blue text-xs font-bold">{coachName.split(' ').map(n => n[0]).join('').slice(0, 2)}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-boon-text">{coachName}</p>
            <p className="text-xs text-gray-400">{sessionCountWithCoach} session{sessionCountWithCoach !== 1 ? 's' : ''} together</p>
          </div>
          <a href="/coach" className="text-xs font-semibold text-boon-blue hover:text-boon-darkBlue transition-colors">Profile</a>
        </div>

        {/* Journal row */}
        <div className="py-4">
          <JournalPromptCard compact />
        </div>

        {/* Practice row */}
        <div className="pt-4">
          <PracticePrompt />
        </div>
      </section>
    </div>
  );
}
