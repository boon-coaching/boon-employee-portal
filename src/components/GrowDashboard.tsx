import { useState, useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Card, Headline, Button, Avatar, Badge } from '../lib/design-system';
import type { Employee, Session, ActionItem, Coach, BaselineSurvey, WelcomeSurveyScale } from '../lib/types';
import type { CoachingStateData } from '../lib/coachingState';
import { COUNTED_SESSION_STATUSES, isUpcomingSession } from '../lib/coachingState';
import { PracticePrompt } from './PracticePrompt';
import type { ProgramInfo, GrowFocusArea } from '../lib/dataFetcher';
import { fetchCoachByName, fetchCoachById, fetchProgramInfo, fetchGrowFocusAreas, updateActionItemStatus } from '../lib/dataFetcher';
import CompetencyProgressCard from './CompetencyProgressCard';
import SessionPrep from './SessionPrep';
import { MilestoneCelebration } from './MilestoneCelebration';
import { JournalPromptCard } from './journal/JournalPromptCard';

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};

type EyebrowColor = 'blue' | 'coral' | 'coral-light' | 'muted' | 'charcoal' | 'white';
const EYEBROW_COLORS: Record<EyebrowColor, string> = {
  blue: 'text-boon-blue',
  coral: 'text-boon-coral',
  'coral-light': 'text-boon-coralLight',
  muted: 'text-boon-charcoal/55',
  charcoal: 'text-boon-charcoal',
  white: 'text-white/80',
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

  const coachPhotoUrl = coachProfile?.photo_url || undefined;

  const pendingActions = actionItems.filter(a => a.status === 'pending');
  const recentlyCompletedActions = actionItems.filter(a => {
    if (a.status !== 'completed') return false;
    if (!a.completed_at) return false;
    const completedDate = new Date(a.completed_at);
    const daysSinceCompletion = (Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCompletion <= 7;
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

  let heroStatement: string;
  let heroKicker: string;
  if (completedCount === 0) {
    heroStatement = 'Before the first.';
    heroKicker = 'Where you begin.';
  } else if (completedCount >= totalExpected - 2) {
    heroStatement = 'The home stretch.';
    heroKicker = `${countAsWord.charAt(0).toUpperCase()}${countAsWord.slice(1)} in.`;
  } else if (completedCount >= Math.ceil(totalExpected / 2)) {
    heroStatement = `Session ${countAsWord}.`;
    heroKicker = 'The middle stretch.';
  } else {
    heroStatement = `Session ${countAsWord}.`;
    heroKicker = 'Still building.';
  }

  const progressPct = Math.min((completedCount / totalExpected) * 100, 100);

  // Next-session navy-card copy. Statement + serif kicker is the signature
  // Boon treatment. Pull session topic if we have it, otherwise fall back
  // to a generic statement with the coach's name.
  const nextSessionTopic = upcomingSession?.goals?.trim() || null;
  const nextSessionStatement = nextSessionTopic
    ? nextSessionTopic
    : hasUpcomingSession
    ? 'The next conversation.'
    : 'Not yet scheduled.';
  const nextSessionKicker = hasUpcomingSession
    ? `With ${coachFirstName}.`
    : `Book with ${coachFirstName}.`;

  // Next-session eyebrow is the date + time when upcoming, the prompt otherwise.
  const nextSessionEyebrow = hasUpcomingSession
    ? `${new Date(upcomingSession!.session_date)
        .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
        .toUpperCase()} · ${new Date(upcomingSession!.session_date).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })}`
    : daysSinceLastSession > 21
    ? `${daysSinceLastSession} DAYS SINCE YOUR LAST`
    : 'UP NEXT';

  const joinableZoomLink = (() => {
    if (!hasUpcomingSession || !upcomingSession?.zoom_join_link) return null;
    const sessionTime = new Date(upcomingSession.session_date).getTime();
    const hoursUntil = (sessionTime - Date.now()) / (1000 * 60 * 60);
    return hoursUntil <= 24 && hoursUntil > -1 ? upcomingSession.zoom_join_link : null;
  })();

  const actionsDone = recentlyCompletedActions.length;
  const actionsTotal = pendingActions.length + recentlyCompletedActions.length;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* ─────────────── Editorial hero ─────────────── */}
      <header className="pb-10 mb-10 border-b border-boon-charcoal/10">
        <div className="flex items-center gap-3 mb-7">
          <span className="w-6 h-px bg-boon-blue" aria-hidden />
          <Eyebrow color="blue">Your progress</Eyebrow>
          <Eyebrow color="muted">· {completedCount} of {totalExpected} with {coachFirstName}</Eyebrow>
        </div>
        <Headline as="h1" size="xl">
          {heroStatement}
          <Headline.Kicker block color="blue">{heroKicker}</Headline.Kicker>
        </Headline>
        <div className="mt-8 flex items-center gap-4">
          <div className="flex-1 max-w-sm h-[3px] bg-boon-charcoal/10 rounded-pill overflow-hidden">
            <div
              className="h-full bg-boon-blue rounded-pill transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <Eyebrow color="muted">{Math.round(progressPct)}% complete</Eyebrow>
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

      {/* ─────────────── Row 1: Next Session (navy) + Reflection (coral) ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 mb-8">
        <Card variant="navy" glow="blue" dots padding="lg">
          <Eyebrow color="coral-light">{nextSessionEyebrow}</Eyebrow>
          <h2
            className="mt-4 font-display font-bold text-white text-[28px] md:text-[32px] leading-[1.15] tracking-[-0.02em]"
          >
            {nextSessionStatement}{' '}
            <span className="font-serif italic font-normal text-boon-coralLight">
              {nextSessionKicker}
            </span>
          </h2>
          <div className="mt-7 flex items-center gap-4">
            <Avatar name={coachName} src={coachPhotoUrl} size="lg" />
            <div>
              <div className="text-sm font-semibold text-white">{coachName}</div>
              <div className="text-xs text-white/65">
                {coachProfile?.headline || 'Your coach'}{coachProfile?.headline ? ' · ' : ''}{sessionCountWithCoach} session{sessionCountWithCoach !== 1 ? 's' : ''} together
              </div>
            </div>
          </div>
          <div className="mt-7 flex items-center gap-3 flex-wrap">
            {joinableZoomLink ? (
              <Button
                as="a"
                href={joinableZoomLink}
                target="_blank"
                rel="noopener noreferrer"
                variant="coral"
                size="md"
              >
                Join session
              </Button>
            ) : hasUpcomingSession ? (
              <Button
                variant="coral"
                size="md"
                onClick={() => setPrepExpanded(!prepExpanded)}
              >
                {prepExpanded ? 'Hide prep' : 'Open prep'}
              </Button>
            ) : profile?.booking_link ? (
              <Button
                as="a"
                href={profile.booking_link}
                target="_blank"
                rel="noopener noreferrer"
                variant="coral"
                size="md"
              >
                Book your next
              </Button>
            ) : null}
            {hasUpcomingSession && (
              <Button
                variant="ghost"
                size="md"
                onClick={() => setPrepExpanded(!prepExpanded)}
                style={{ color: 'rgba(255,255,255,.85)' }}
              >
                {prepExpanded ? 'Hide agenda' : 'View agenda'}
              </Button>
            )}
          </div>
          {prepExpanded && hasUpcomingSession && (
            <div className="mt-7 pt-7 border-t border-white/15">
              <SessionPrep
                sessions={sessions}
                actionItems={actionItems}
                coachName={coachName}
                userEmail={userEmail}
                onActionUpdate={onActionUpdate}
              />
            </div>
          )}
        </Card>

        {/* Weekly reflection — coral-outlined. JournalPromptCard owns the form
            state + save logic; we only change its framing via compact prop. */}
        <Card variant="coral-outlined" padding="lg" accent>
          <Eyebrow color="coral">Weekly reflection</Eyebrow>
          <div className="mt-3">
            <JournalPromptCard compact />
          </div>
        </Card>
      </div>

      {/* ─────────────── Row 2: Where we left off (full width) ─────────────── */}
      {completedSessions.length > 0 && (
        <Card padding="lg" className="mb-8">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-pill bg-boon-coral/12 flex items-center justify-center text-boon-coral">
                <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </span>
              <Eyebrow color="coral">Where we left off</Eyebrow>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-charcoal/45">
                · From {new Date(lastSession!.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            {actionsTotal > 0 && (
              <Badge variant={actionsDone === actionsTotal ? 'success' : 'neutral'}>
                {actionsDone} of {actionsTotal} done
              </Badge>
            )}
          </div>

          {lastSession?.goals && (
            <div className="mb-7">
              <Eyebrow color="muted" className="mb-3">Current goal</Eyebrow>
              <Headline as="h3" size="md" statement={lastSession.goals} />
            </div>
          )}

          {(pendingActions.length > 0 || recentlyCompletedActions.length > 0) ? (
            <div>
              <Eyebrow color="muted" className="mb-3">Action items</Eyebrow>
              <div className="flex flex-col gap-2.5">
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
        </Card>
      )}

      {/* ─────────────── Row 3: Competency growth (full width, when available) ─────────────── */}
      {focusAreas.length > 0 && (
        <div className="mb-8">
          <CompetencyProgressCard focusAreas={focusAreas} />
        </div>
      )}

      {/* ─────────────── Row 4: Coach + Practice (side by side) ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="md">
          <Eyebrow color="muted" className="mb-4">Your coach</Eyebrow>
          <div className="flex items-center gap-4">
            <Avatar name={coachName} src={coachPhotoUrl} size="xl" />
            <div className="flex-1 min-w-0">
              <h4 className="font-display font-bold text-boon-navy text-[20px] leading-tight tracking-[-0.015em]">{coachName}</h4>
              <p className="text-xs text-boon-charcoal/55 mt-1">
                {coachProfile?.headline || 'Your coach'}
              </p>
              <p className="text-xs text-boon-charcoal/55 mt-0.5">
                {sessionCountWithCoach} session{sessionCountWithCoach !== 1 ? 's' : ''} together
              </p>
            </div>
            <Button as="a" href="/coach" variant="ghost" size="sm">
              Profile →
            </Button>
          </div>
        </Card>

        <PracticePrompt />
      </div>
    </div>
  );
}
