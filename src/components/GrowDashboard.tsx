import { useState, useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { Employee, Session, ActionItem, Coach, BaselineSurvey, WelcomeSurveyScale } from '../lib/types';

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};

// Local Eyebrow helper for editorial section labels.
// Swap for @boon/design-system's Eyebrow once the package ships.
type EyebrowColor = 'blue' | 'coral' | 'muted' | 'charcoal';
const EYEBROW_COLORS: Record<EyebrowColor, string> = {
  blue: 'text-boon-blue',
  coral: 'text-boon-coral',
  muted: 'text-boon-charcoal/55',
  charcoal: 'text-boon-charcoal',
};
function Eyebrow({
  color = 'charcoal',
  className = '',
  children,
}: {
  color?: EyebrowColor;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`text-[11px] font-extrabold uppercase tracking-[0.18em] ${EYEBROW_COLORS[color]} ${className}`}>
      {children}
    </div>
  );
}
import type { CoachingStateData } from '../lib/coachingState';
import { COUNTED_SESSION_STATUSES, isUpcomingSession } from '../lib/coachingState';
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
  const upcomingSession = sessions
    .filter(isUpcomingSession)
    .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())[0] || null;
  const lastSession = completedSessions.length > 0 ? completedSessions[0] : null;

  const daysSinceLastSession = lastSession
    ? Math.floor((Date.now() - new Date(lastSession.session_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const coachName = lastSession?.coach_name || upcomingSession?.coach_name || 'Your Coach';
  const coachFirstName = coachName.split(' ')[0];

  const [programInfo, setProgramInfo] = useState<ProgramInfo | null>(null);
  const [focusAreas, setFocusAreas] = useState<GrowFocusArea[]>([]);
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);

  useEffect(() => {
    const loadGrowData = async () => {
      if (!userEmail) return;

      devLog('[GrowDashboard] Loading data for:', { userEmail, coachName, coachId: profile?.coach_id, program: profile?.coaching_program });

      const [progInfo, areas] = await Promise.all([
        profile?.coaching_program ? fetchProgramInfo(profile.coaching_program) : Promise.resolve(null),
        fetchGrowFocusAreas(userEmail),
      ]);

      let coach: Coach | null = null;
      if (profile?.coach_id) {
        coach = await fetchCoachById(profile.coach_id);
        devLog('[GrowDashboard] Coach fetch by ID result:', { coachId: profile.coach_id, coachFound: !!coach });
      }
      if (!coach && coachName !== 'Your Coach') {
        coach = await fetchCoachByName(coachName);
        devLog('[GrowDashboard] Coach fetch by name result:', { coachName, coachFound: !!coach });
      }

      if (progInfo) setProgramInfo(progInfo);
      if (areas) setFocusAreas(areas);
      if (coach) setCoachProfile(coach as Coach);
    };

    loadGrowData();
  }, [profile?.coaching_program, profile?.coach_id, userEmail, coachName]);

  const sessionsWithCoach = sessions.filter(s =>
    COUNTED_SESSION_STATUSES.includes(s.status) && s.coach_name === coachName
  );
  const sessionCountWithCoach = sessionsWithCoach.length;

  const getCoachPhotoUrl = () => coachProfile?.photo_url || null;

  const pendingActions = actionItems.filter(a => a.status === 'pending');
  const recentlyCompletedActions = actionItems.filter(a => {
    if (a.status !== 'completed') return false;
    if (!a.completed_at) return false;
    const completedDate = new Date(a.completed_at);
    const daysSinceCompletion = (Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCompletion <= 7;
  });

  devLog('[GrowDashboard] Action items:', {
    totalReceived: actionItems.length,
    pendingCount: pendingActions.length,
    allItems: actionItems,
    completedSessionsCount: completedSessions.length
  });

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

  // Editorial hero title + kicker computed from program progress.
  const completedCount = coachingState.completedSessionCount || 0;
  const totalExpected = programInfo?.sessions_per_employee || 12;
  const numberWord = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  const countAsWord = completedCount >= 0 && completedCount < numberWord.length
    ? numberWord[completedCount]
    : String(completedCount);

  let heroTitle: string;
  let heroKicker: string;
  if (completedCount === 0) {
    heroTitle = 'Before the first.';
    heroKicker = 'Where you begin.';
  } else if (completedCount >= totalExpected - 2) {
    heroTitle = 'The home stretch.';
    heroKicker = `${countAsWord.charAt(0).toUpperCase()}${countAsWord.slice(1)} in.`;
  } else if (completedCount >= Math.ceil(totalExpected / 2)) {
    heroTitle = `Session ${countAsWord}.`;
    heroKicker = 'The middle stretch.';
  } else {
    heroTitle = `Session ${countAsWord}.`;
    heroKicker = 'Still building.';
  }

  const progressPct = Math.min((completedCount / totalExpected) * 100, 100);

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* Editorial hero */}
      <header className="pb-10 mb-10 border-b border-boon-charcoal/10">
        <div className="flex items-center gap-3 mb-7">
          <span className="w-6 h-px bg-boon-blue" aria-hidden />
          <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-blue">
            Your progress
          </span>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-charcoal/50">
            · {completedCount} of {totalExpected} with {coachFirstName}
          </span>
        </div>
        <h1 className="font-display font-bold text-boon-navy text-[52px] md:text-[74px] leading-[0.98] tracking-[-0.03em]">
          {heroTitle}
          <span className="block font-serif italic font-normal text-boon-blue mt-1">
            {heroKicker}
          </span>
        </h1>
        {/* Slim progress bar with Boon tokens */}
        <div className="mt-8 flex items-center gap-4">
          <div className="flex-1 max-w-sm h-[3px] bg-boon-charcoal/10 rounded-pill overflow-hidden">
            <div
              className="h-full bg-boon-blue rounded-pill transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-boon-charcoal/60">
            {Math.round(progressPct)}% complete
          </span>
        </div>
      </header>

      <div className="mb-10">
        <MilestoneCelebration
          completedSessionCount={completedSessions.length}
          programType={programType === 'EXEC' ? 'EXEC' : 'GROW'}
          totalExpected={totalExpected}
          userEmail={userEmail}
        />
      </div>

      <div className="space-y-6 md:space-y-8">

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* ── Left column: Where We Left Off ── */}
        <div className="lg:col-span-3 space-y-8">
          {hasUpcomingSession ? (
            <section className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden">
              <button
                onClick={() => setPrepExpanded(!prepExpanded)}
                className="w-full flex items-center justify-between p-6 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Session with {coachFirstName}</p>
                    <p className="text-xs text-slate-500">
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
                  <svg className={`w-5 h-5 text-slate-400 transition-transform ${prepExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              {prepExpanded && (
                <div className="px-6 pb-6 border-t border-slate-100">
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
          ) : completedSessions.length === 0 ? (
            <CompetencyProgressCard focusAreas={focusAreas} />
          ) : null}

          {/* Where We Left Off — warm editorial beige card, per handoff.
              Intentionally stays warm (not navy-ified) to keep the
              journal/reflection feel separate from the navy authority
              surfaces used for focus + practice. */}
          {completedSessions.length > 0 && (
            <section className="rounded-card p-8 border border-[#F5E3C8] bg-[#FFF7EE]">
              <div className="flex items-center gap-2.5 mb-5">
                <span className="w-7 h-7 rounded-pill bg-boon-warning/12 flex items-center justify-center text-boon-warning">
                  <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </span>
                <Eyebrow color="coral">Where we left off</Eyebrow>
              </div>

              {lastSession?.goals && (
                <div className="mb-6">
                  <Eyebrow color="muted" className="mb-2.5">Current goal</Eyebrow>
                  <h2 className="font-display font-bold text-[26px] leading-[1.15] tracking-[-0.02em] text-boon-navy">
                    {lastSession.goals}
                  </h2>
                </div>
              )}

              {(pendingActions.length > 0 || recentlyCompletedActions.length > 0) ? (
                <div>
                  <div className="flex items-center justify-between">
                    <Eyebrow color="muted">Action items</Eyebrow>
                    <span className="text-xs font-semibold text-boon-charcoal/60">
                      {recentlyCompletedActions.length} of {pendingActions.length + recentlyCompletedActions.length} done
                    </span>
                  </div>
                  <div className="mt-3 flex flex-col gap-2.5">
                    {pendingActions.map((action) => {
                      const isUpdating = updatingActionId === action.id;
                      return (
                        <button
                          key={action.id}
                          onClick={() => handleCompleteAction(action.id)}
                          disabled={isUpdating}
                          className={`flex items-start gap-3.5 p-4 rounded-btn bg-white border border-boon-charcoal/[0.08] hover:border-boon-blue/40 hover:shadow-sm transition-all text-left group ${isUpdating ? 'opacity-50' : ''}`}
                          title="Mark as complete"
                        >
                          <span className="w-5 h-5 rounded-md border-[1.5px] border-boon-charcoal/30 group-hover:border-boon-blue group-hover:bg-boon-blue/5 transition-all flex-shrink-0 mt-0.5 flex items-center justify-center">
                            <svg className="w-3 h-3 text-transparent group-hover:text-boon-blue transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-boon-charcoal leading-relaxed">{action.action_text}</p>
                            <p className="mt-1.5 text-[11px] text-boon-charcoal/50">
                              From {new Date(action.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                    {recentlyCompletedActions.map((action) => (
                      <div
                        key={action.id}
                        className="flex items-start gap-3.5 p-4 rounded-btn bg-white/50 border border-boon-charcoal/[0.06]"
                      >
                        <span className="w-5 h-5 rounded-md bg-boon-blue flex-shrink-0 mt-0.5 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-boon-charcoal/50 leading-relaxed line-through">{action.action_text}</p>
                          <p className="mt-1.5 text-[11px] text-boon-charcoal/50">
                            Done {action.completed_at ? new Date(action.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'recently'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : !lastSession?.goals && (
                <p className="text-sm italic text-boon-charcoal/60">
                  Your goals and action items from coaching sessions will appear here.
                </p>
              )}
            </section>
          )}
        </div>

        {/* ── Right column: Session, Coach, Reflection, Practice ── */}
        <div className="lg:col-span-2 space-y-8">
          {/* Next Session */}
          <section className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6">
            {hasUpcomingSession ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="font-semibold text-slate-900">Next Session</span>
                  </div>
                  {upcomingSession?.zoom_join_link && (() => {
                    const sessionTime = new Date(upcomingSession.session_date).getTime();
                    const hoursUntil = (sessionTime - Date.now()) / (1000 * 60 * 60);
                    return hoursUntil <= 24 && hoursUntil > -1 ? (
                      <a
                        href={upcomingSession.zoom_join_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-all"
                      >
                        Join
                      </a>
                    ) : null;
                  })()}
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm font-medium text-slate-700">
                    {new Date(upcomingSession!.session_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(upcomingSession!.session_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} with {coachFirstName}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="font-semibold text-slate-900">Next Session</span>
                  </div>
                  {profile?.booking_link && (
                    <a
                      href={profile.booking_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all"
                    >
                      Book
                    </a>
                  )}
                </div>
                <div className="p-4 bg-slate-50 rounded-xl text-center">
                  <p className="text-sm text-slate-500 font-medium">No upcoming session</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {daysSinceLastSession > 21
                      ? `${daysSinceLastSession} days since last session`
                      : `Schedule your next 1:1 with ${coachFirstName}`}
                  </p>
                </div>
              </>
            )}
          </section>

          {/* Coach */}
          <section className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getCoachPhotoUrl() ? (
                  <img src={getCoachPhotoUrl()!} alt={coachName} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center border-2 border-white shadow-sm">
                    <span className="text-blue-600 text-sm font-bold">{coachName.split(' ').map(n => n[0]).join('').slice(0, 2)}</span>
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-slate-900">{coachName}</h4>
                  <p className="text-xs text-slate-500">{sessionCountWithCoach} session{sessionCountWithCoach !== 1 ? 's' : ''} together</p>
                </div>
              </div>
              <a href="/coach" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">Profile</a>
            </div>
          </section>

          {/* Weekly Reflection */}
          <JournalPromptCard compact />

          {/* Recommended Practice */}
          <PracticePrompt />
        </div>
      </div>
      </div>
    </div>
  );
}
