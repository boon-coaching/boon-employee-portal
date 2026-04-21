import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { Employee, Session, ActionItem, Coach, BaselineSurvey, WelcomeSurveyScale } from '../lib/types';

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};
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

          {/* Where We Left Off — goal + action items */}
          {completedSessions.length > 0 && (
            <section className="bg-[#FFF9F0] rounded-2xl shadow-xl shadow-slate-200/50 p-8">
              <div className="flex items-center gap-2 text-amber-600 mb-6">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest">Where we left off</span>
              </div>

              {lastSession?.goals && (
                <div className="mb-6">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Current Goal</span>
                  <h2 className="text-2xl font-bold text-slate-900 mt-2 leading-tight">
                    {lastSession.goals}
                  </h2>
                </div>
              )}

              {(pendingActions.length > 0 || recentlyCompletedActions.length > 0) ? (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Action Items</span>
                  <div className="space-y-3 mt-4">
                    {pendingActions.map((action) => {
                      const isUpdating = updatingActionId === action.id;
                      return (
                        <div
                          key={action.id}
                          className={`flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all ${isUpdating ? 'opacity-50' : ''}`}
                        >
                          <button
                            onClick={() => handleCompleteAction(action.id)}
                            disabled={isUpdating}
                            className="mt-1 w-5 h-5 rounded-full border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all flex-shrink-0 flex items-center justify-center group"
                            title="Mark as complete"
                          >
                            <svg className="w-2.5 h-2.5 text-transparent group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <div className="flex-1">
                            <p className="text-sm text-slate-700 leading-relaxed">{action.action_text}</p>
                            <span className="text-[10px] text-slate-400 mt-2 block">
                              From {new Date(action.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {recentlyCompletedActions.map((action) => (
                      <div
                        key={action.id}
                        className="flex items-start gap-4 p-4 bg-green-50/50 rounded-xl border border-green-200/30"
                      >
                        <div className="mt-1 w-5 h-5 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-slate-400 leading-relaxed line-through">{action.action_text}</p>
                          <span className="text-[10px] text-green-600 mt-2 block">
                            Completed {action.completed_at ? new Date(action.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'recently'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : !lastSession?.goals && (
                <p className="text-slate-500 text-sm italic">
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
