import { useState, useEffect } from 'react';
import type { Employee, Session, ActionItem, View, Coach, BaselineSurvey, WelcomeSurveyScale } from '../lib/types';
import type { CoachingStateData } from '../lib/coachingState';
import { COUNTED_SESSION_STATUSES, isUpcomingSession } from '../lib/coachingState';
import type { ProgramInfo, GrowFocusArea } from '../lib/dataFetcher';
import { fetchCoachByName, fetchCoachById, fetchProgramInfo, fetchGrowFocusAreas, updateActionItemStatus, fetchMatchSummary } from '../lib/dataFetcher';
import ProgramProgressCard from './ProgramProgressCard';
import CompetencyProgressCard from './CompetencyProgressCard';
import SessionPrep from './SessionPrep';

/**
 * Extract the specific coach's summary from the full match_summary text.
 * The match_summary typically contains multiple entries like:
 * "Coach 1: Jane Doe - Jane brings... Coach 2: John Smith - John's expertise..."
 * This function finds and returns only the summary for the specified coach.
 */
function extractCoachSummary(matchSummary: string | null, coachName: string): string | null {
  if (!matchSummary || !coachName) return null;

  // Get the coach's first name and last name
  const nameParts = coachName.trim().split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

  // Try to find the coach's section in the match summary
  // Pattern: "Coach N: [Name] - [description]"
  const coachPattern = new RegExp(
    `Coach\\s*\\d*:?\\s*${firstName}(?:\\s+\\w+)*\\s*[-–—]\\s*([^]*?)(?=Coach\\s*\\d|$)`,
    'i'
  );

  const match = matchSummary.match(coachPattern);
  if (match) {
    // Return the full matched section including the coach's name intro
    const fullMatch = match[0].trim();
    // Clean up and return just the description part after the dash
    const dashIndex = fullMatch.search(/[-–—]/);
    if (dashIndex !== -1) {
      return fullMatch.substring(dashIndex + 1).trim();
    }
    return fullMatch;
  }

  // Alternative: Try searching by last name if first name didn't match
  if (lastName) {
    const lastNamePattern = new RegExp(
      `Coach\\s*\\d*:?\\s*\\w+\\s+${lastName}\\s*[-–—]\\s*([^]*?)(?=Coach\\s*\\d|$)`,
      'i'
    );
    const lastNameMatch = matchSummary.match(lastNamePattern);
    if (lastNameMatch) {
      const fullMatch = lastNameMatch[0].trim();
      const dashIndex = fullMatch.search(/[-–—]/);
      if (dashIndex !== -1) {
        return fullMatch.substring(dashIndex + 1).trim();
      }
      return fullMatch;
    }
  }

  // Coach not found in match_summary
  return null;
}

/**
 * Create a personalized coach description based on the employee's coaching goals.
 */
function createPersonalizedDescription(coachFirstName: string, coachingGoals: string | null): string | null {
  if (!coachingGoals) return null;

  // Truncate goals if too long (keep first ~150 chars at sentence boundary)
  let truncatedGoals = coachingGoals;
  if (coachingGoals.length > 150) {
    const truncated = coachingGoals.substring(0, 150);
    const lastPeriod = truncated.lastIndexOf('.');
    if (lastPeriod > 80) {
      truncatedGoals = coachingGoals.substring(0, lastPeriod + 1);
    } else {
      const lastSpace = truncated.lastIndexOf(' ');
      truncatedGoals = lastSpace > 0 ? coachingGoals.substring(0, lastSpace) + '...' : truncated + '...';
    }
  }

  return `Based on your goal to ${truncatedGoals.toLowerCase().replace(/^i want to |^i'd like to |^i would like to /i, '').replace(/\.$/, '')}, ${coachFirstName} will partner with you to develop strategies and build the skills you need to succeed.`;
}

/**
 * Truncate text to approximately N characters, ending at a sentence boundary.
 */
function truncateBio(text: string | null, maxLength: number = 280): string | null {
  if (!text) return null;
  if (text.length <= maxLength) return text;

  // Try to find a sentence boundary within the max length
  const truncated = text.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastExclaim = truncated.lastIndexOf('!');
  const lastQuestion = truncated.lastIndexOf('?');

  const lastSentenceEnd = Math.max(lastPeriod, lastExclaim, lastQuestion);

  if (lastSentenceEnd > maxLength * 0.4) {
    return text.substring(0, lastSentenceEnd + 1);
  }

  // No good sentence boundary, truncate at word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 0) {
    return text.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

interface GrowDashboardProps {
  profile: Employee | null;
  sessions: Session[];
  actionItems: ActionItem[];
  baseline: BaselineSurvey | null;
  welcomeSurveyScale?: WelcomeSurveyScale | null;
  coachingState: CoachingStateData;
  onActionUpdate: () => void;
  userEmail: string;
  onNavigate?: (view: View) => void;
}

export default function GrowDashboard({
  profile,
  sessions,
  actionItems,
  baseline,
  welcomeSurveyScale,
  coachingState,
  onActionUpdate,
  userEmail,
  onNavigate,
}: GrowDashboardProps) {
  const [updatingActionId, setUpdatingActionId] = useState<string | null>(null);

  const completedSessions = sessions.filter(s => s.status === 'Completed');
  // Get the NEAREST upcoming session (sort by date ascending, take first)
  const upcomingSession = sessions
    .filter(isUpcomingSession)
    .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())[0] || null;
  const lastSession = completedSessions.length > 0 ? completedSessions[0] : null;

  const coachName = lastSession?.coach_name || upcomingSession?.coach_name || 'Your Coach';
  const coachFirstName = coachName.split(' ')[0];

  // GROW-specific state
  const [programInfo, setProgramInfo] = useState<ProgramInfo | null>(null);
  const [focusAreas, setFocusAreas] = useState<GrowFocusArea[]>([]);
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);
  const [matchSummary, setMatchSummary] = useState<string | null>(null);
  const [isLoadingCoachData, setIsLoadingCoachData] = useState(true);

  // Load GROW-specific data
  useEffect(() => {
    const loadGrowData = async () => {
      // Only require userEmail - profile.program may be null if derived from session
      if (!userEmail) return;

      setIsLoadingCoachData(true);
      console.log('[GrowDashboard] Loading data for:', { userEmail, coachName, coachId: profile?.coach_id, program: profile?.program });

      // Fetch program info and focus areas in parallel (program info is optional)
      const [progInfo, areas] = await Promise.all([
        profile?.program ? fetchProgramInfo(profile.program) : Promise.resolve(null),
        fetchGrowFocusAreas(userEmail),
      ]);

      // Try to fetch coach by ID first (more reliable), then fall back to name
      let coach: Coach | null = null;
      if (profile?.coach_id) {
        coach = await fetchCoachById(profile.coach_id);
        console.log('[GrowDashboard] Coach fetch by ID result:', {
          coachId: profile.coach_id,
          coachFound: !!coach,
          coachPhotoUrl: coach?.photo_url
        });
      }

      // Fall back to name lookup if ID lookup didn't work
      if (!coach && coachName !== 'Your Coach') {
        coach = await fetchCoachByName(coachName);
        console.log('[GrowDashboard] Coach fetch by name result:', {
          coachName,
          coachFound: !!coach,
          coachPhotoUrl: coach?.photo_url
        });
      }

      console.log('[GrowDashboard] Final coach result:', {
        coachName,
        coachFound: !!coach,
        coachPhotoUrl: coach?.photo_url,
        fullCoachData: coach
      });

      // Fetch match summary for dynamic coach description
      let summary: string | null = null;
      if (profile?.id) {
        summary = await fetchMatchSummary(profile.id, userEmail);
        console.log('[GrowDashboard] Match summary result:', summary);
      }

      if (progInfo) setProgramInfo(progInfo);
      if (areas) setFocusAreas(areas);
      if (coach) setCoachProfile(coach as Coach);
      if (summary) setMatchSummary(summary);
      setIsLoadingCoachData(false);
    };

    loadGrowData();
  }, [profile?.program, profile?.coach_id, userEmail, coachName]);

  // Count sessions with this specific coach (includes late cancel, no-show)
  const sessionsWithCoach = sessions.filter(s =>
    COUNTED_SESSION_STATUSES.includes(s.status) && s.coach_name === coachName
  );
  const sessionCountWithCoach = sessionsWithCoach.length;

  // Helper: Get coach photo URL or generate placeholder
  const getCoachPhotoUrl = () => {
    if (coachProfile?.photo_url) {
      return coachProfile.photo_url;
    }
    // Use picsum.photos as placeholder (same as SCALE coach page)
    return `https://picsum.photos/seed/${coachName.replace(/\s/g, '')}/200/200`;
  };

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
  console.log('[GrowDashboard] Action items:', {
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
      onActionUpdate();
    }
    setUpdatingActionId(null);
  }

  const hasUpcomingSession = !!upcomingSession;

  return (
    <div className="max-w-3xl mx-auto space-y-8 md:space-y-10 animate-fade-in">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-2">
        <div className="text-center sm:text-left">
          <h1 className="text-3xl md:text-5xl font-extrabold text-boon-text tracking-tight">
            Hi {profile?.first_name || 'there'}
          </h1>
          <p className="text-gray-500 mt-2 text-lg font-medium">
            Your GROW coaching journey
          </p>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          BOOK YOUR NEXT SESSION - HERO CTA when no upcoming session
          Shows first to drive engagement
          ═══════════════════════════════════════════════════════════════════ */}
      {!hasUpcomingSession && (
        <section className="bg-gradient-to-br from-boon-blue/10 via-white to-boon-lightBlue/30 rounded-[2rem] p-8 border-2 border-boon-blue/30 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-boon-blue flex items-center justify-center shadow-lg shadow-boon-blue/30">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-boon-text">Book Your Next Session</h2>
              <p className="text-gray-500 text-sm">Continue your coaching journey with {coachFirstName}</p>
            </div>
          </div>
          {profile?.booking_link ? (
            <a
              href={profile.booking_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 text-base font-bold text-white bg-boon-blue rounded-xl hover:bg-boon-darkBlue transition-all shadow-lg shadow-boon-blue/30 active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Book a Session
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          ) : (
            <p className="text-gray-600 bg-white/60 px-5 py-4 rounded-xl border border-boon-blue/10">
              <span className="font-medium">Ready to continue?</span> Reach out to {coachFirstName} or your program administrator to schedule your next session.
            </p>
          )}
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          PROGRAM PROGRESS CARD - Full width (GROW-specific)
          ═══════════════════════════════════════════════════════════════════ */}
      <ProgramProgressCard
        programInfo={programInfo}
        completedSessions={coachingState.completedSessionCount}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          SESSION PREP - Consolidated component when upcoming session (like SCALE)
          ═══════════════════════════════════════════════════════════════════ */}
      {hasUpcomingSession && (
        <SessionPrep
          sessions={sessions}
          actionItems={actionItems}
          coachName={coachName}
          userEmail={userEmail}
          onActionUpdate={onActionUpdate}
        />
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
          </section>
        )
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          YOUR COACH CARD
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Your Coach</span>
          </div>

          {isLoadingCoachData ? (
            /* Loading skeleton */
            <div className="animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-16 h-20 rounded-xl bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-gray-200 rounded w-32" />
                  <div className="h-3 bg-gray-200 rounded w-48" />
                  <div className="h-4 bg-gray-200 rounded w-24" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="h-4 bg-gray-200 rounded w-5/6" />
                <div className="h-4 bg-gray-200 rounded w-4/6" />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <img
                  src={getCoachPhotoUrl()}
                  alt={coachName}
                  className="w-16 h-20 rounded-xl object-cover object-[center_15%] ring-2 ring-boon-bg shadow-sm"
                />
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-boon-text">{coachName}</h3>
                  {coachProfile?.headline ? (
                    <p className="text-xs text-boon-blue font-bold uppercase tracking-widest mt-0.5">
                      {coachProfile.headline}
                    </p>
                  ) : (
                    <p className="text-xs text-boon-blue font-bold uppercase tracking-widest mt-0.5">Executive Coach</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    {sessionCountWithCoach} {sessionCountWithCoach === 1 ? 'session' : 'sessions'} together
                  </p>
                </div>
              </div>

              {/* Dynamic coach description: match_summary > personalized from goals > truncated bio > generic */}
              {(() => {
                // Debug logging for coach description
                const coachingGoals = baseline?.coaching_goals || welcomeSurveyScale?.coaching_goals || null;
                console.log('[GrowDashboard] Coach description debug:', {
                  matchSummary: matchSummary ? 'exists' : 'null',
                  extractedSummary: extractCoachSummary(matchSummary, coachName),
                  hasBaseline: !!baseline,
                  hasWelcomeSurveyScale: !!welcomeSurveyScale,
                  baselineGoals: baseline?.coaching_goals,
                  scaleGoals: welcomeSurveyScale?.coaching_goals,
                  coachingGoals,
                  personalizedDesc: createPersonalizedDescription(coachFirstName, coachingGoals),
                  coachBio: coachProfile?.bio ? 'exists' : 'null',
                });
                return null;
              })()}
              <p className="text-sm text-gray-600 mt-4 leading-relaxed">
                {truncateBio(extractCoachSummary(matchSummary, coachName), 280)
                  || createPersonalizedDescription(coachFirstName, baseline?.coaching_goals || welcomeSurveyScale?.coaching_goals || null)
                  || truncateBio(coachProfile?.bio || null, 280)
                  || `${coachFirstName} specializes in leadership development and helping professionals unlock their potential through personalized coaching.`}
              </p>
            </>
          )}
        </section>

      {/* ═══════════════════════════════════════════════════════════════════
          THINGS YOU'RE WORKING ON - Action items (only show if no sessions completed AND no upcoming session)
          Note: When there's an upcoming session, SessionPrep handles action items
          ═══════════════════════════════════════════════════════════════════ */}
      {!hasUpcomingSession && completedSessions.length === 0 && pendingActions.length > 0 && (
        <section className="bg-gradient-to-br from-boon-amberLight/30 to-white rounded-[2rem] p-8 border border-boon-amber/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-boon-amber/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-boon-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-boon-amber uppercase tracking-widest">Things You're Working On</h2>
          </div>
          <div className="space-y-3">
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
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          EXPLORE PRACTICE SPACE
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-gradient-to-br from-purple-50 to-boon-bg rounded-[2rem] p-8 border border-purple-100/50 text-center">
        <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-boon-text mb-2">Practice Space</h3>
        <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
          Prepare for challenging conversations with AI-powered scenarios.
        </p>
        <button
          onClick={() => onNavigate?.('practice')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-600/20"
        >
          Explore scenarios
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </section>
    </div>
  );
}
