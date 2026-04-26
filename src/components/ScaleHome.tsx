import { useState, useEffect, type ReactNode } from 'react';
import { Card, Headline, Button, Avatar, Badge } from '../lib/design-system';
import type { Employee, Session, ActionItem, BaselineSurvey, WelcomeSurveyScale, Coach } from '../lib/types';
import type { ScaleCheckpointStatus } from '../lib/types';
import type { ProgramConfig } from '../lib/dataFetcher';
import { updateActionItemStatus, fetchCoachByName } from '../lib/dataFetcher';
import { isUpcomingSession } from '../lib/coachingState';
import SessionPrep from './SessionPrep';
import { PracticePrompt } from './PracticePrompt';
import { JournalPromptCard } from './journal/JournalPromptCard';

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
  checkpointStatus,
  onActionUpdate,
  userEmail,
  onStartCheckpoint,
  onDismissCheckpoint,
  programConfig,
  contractPeriodSessions,
}: ScaleHomeProps) {
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);
  const [prepExpanded, setPrepExpanded] = useState(false);

  const completedSessions = sessions
    .filter(s => s.status === 'Completed')
    .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

  const upcomingSession = sessions
    .filter(isUpcomingSession)
    .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())[0] || null;
  const lastSession = completedSessions[0] ?? null;

  const daysSinceLastSession = lastSession
    ? Math.floor((Date.now() - new Date(lastSession.session_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const coachName = lastSession?.coach_name || upcomingSession?.coach_name || 'Your Coach';
  const coachFirstName = coachName.split(' ')[0];

  useEffect(() => {
    if (coachName && coachName !== 'Your Coach') {
      fetchCoachByName(coachName).then(c => setCoachProfile(c as Coach | null));
    }
  }, [coachName]);
  const coachPhotoUrl = coachProfile?.photo_url || undefined;

  // PEPM cap handling. Only a subset of SCALE contracts set a cap; when present
  // the hero gets a progress bar against that cap, otherwise SCALE is framed
  // as ongoing with no endpoint.
  const sessionCap = programConfig?.sessions_per_employee ?? null;
  const contractSessionCount = contractPeriodSessions !== null && contractPeriodSessions !== undefined
    ? contractPeriodSessions.length
    : completedSessions.length;
  const hasCap = sessionCap !== null && sessionCap > 0;

  const completedCount = completedSessions.length;
  const sessionCountWithCoach = completedSessions.filter(s => s.coach_name === coachName).length;

  const numberWord = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  const countAsWord = completedCount >= 0 && completedCount < numberWord.length
    ? numberWord[completedCount]
    : String(completedCount);
  const capitalize = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;

  // Editorial hero. SCALE is ongoing, so copy evolves with cadence milestones
  // rather than with a cohort arc.
  let heroStatement: string;
  let heroKicker: string;
  if (completedCount === 0) {
    heroStatement = 'Before the first.';
    heroKicker = 'Where you begin.';
  } else if (completedCount === 1) {
    heroStatement = 'Session one.';
    heroKicker = 'It begins.';
  } else if (completedCount < 6) {
    heroStatement = `Session ${countAsWord}.`;
    heroKicker = 'Finding the rhythm.';
  } else if (completedCount < 12) {
    heroStatement = `Session ${countAsWord}.`;
    heroKicker = 'Steady cadence.';
  } else {
    heroStatement = `${capitalize(countAsWord)} sessions in.`;
    heroKicker = 'The long game.';
  }

  const momentumLabel = (() => {
    if (completedCount === 0) return 'JUST STARTING';
    if (completedCount < 3) return 'EARLY STEPS';
    if (completedCount < 6) return 'FINDING RHYTHM';
    if (completedCount < 12) return 'STEADY CADENCE';
    return 'LONG GAME';
  })();

  const currentFocus = checkpointStatus.latestCheckpoint?.focus_area;
  const hasUpcomingSession = !!upcomingSession;

  const nextSessionTopic = upcomingSession?.goals?.trim() || null;
  const nextSessionStatement = nextSessionTopic
    ? nextSessionTopic
    : hasUpcomingSession
    ? 'The next conversation.'
    : profile?.booking_link
    ? 'Your next conversation.'
    : 'Not yet scheduled.';
  const nextSessionKicker = hasUpcomingSession
    ? `With ${coachFirstName}.`
    : profile?.booking_link
    ? `Book with ${coachFirstName}.`
    : 'Check back soon.';

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

  async function handleToggleAction(itemId: string, currentStatus: string) {
    setUpdatingItem(itemId);
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    const success = await updateActionItemStatus(itemId, newStatus);
    if (success) onActionUpdate();
    setUpdatingItem(null);
  }

  // Checkpoint prompt copy. Three sub-states: first-ever at low session count,
  // first-ever but arriving late (>6 sessions), and ongoing Nth check-in.
  const isFirstCheckpoint = checkpointStatus.currentCheckpointNumber === 1;
  const firstCheckpointLateArrival = isFirstCheckpoint && completedSessions.length > 6;
  const checkpointEyebrow = isFirstCheckpoint
    ? (firstCheckpointLateArrival ? 'CHECK-IN DUE' : 'FIRST CHECK-IN')
    : `CHECK-IN ${checkpointStatus.currentCheckpointNumber}`;
  const checkpointStatement = isFirstCheckpoint
    ? (firstCheckpointLateArrival ? 'Check-in due.' : 'First check-in.')
    : `${checkpointStatus.nextCheckpointDueAtSession} sessions in.`;
  const checkpointKicker = isFirstCheckpoint && !firstCheckpointLateArrival
    ? "Where you're starting."
    : "See what's shifted.";
  const checkpointBody = isFirstCheckpoint && !firstCheckpointLateArrival
    ? 'Two minutes to set a baseline. This is what you measure growth against later.'
    : 'Two minutes to reflect on what has changed and set your focus.';

  const sessionWithGoals = completedSessions.find(s => s.goals || s.plan) || null;
  const hasLeftOffContent = !!currentFocus || !!sessionWithGoals || actionItems.length > 0;
  const completedActionCount = actionItems.filter(a => a.status === 'completed').length;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-32 md:pb-0">
      {/* ─────────────── Editorial hero ─────────────── */}
      <header className="pb-6 mb-6 border-b border-boon-charcoal/10">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="w-6 h-px bg-boon-blue" aria-hidden />
          <Eyebrow color="blue">Your practice</Eyebrow>
          {coachName !== 'Your Coach' && sessionCountWithCoach > 0 && (
            <Eyebrow color="muted">
              · {sessionCountWithCoach} session{sessionCountWithCoach !== 1 ? 's' : ''} with {coachFirstName}
            </Eyebrow>
          )}
          <Eyebrow color="coral">· {momentumLabel}</Eyebrow>
        </div>
        <Headline as="h1" size="lg">
          {heroStatement}{' '}
          <Headline.Kicker color="blue">{heroKicker}</Headline.Kicker>
        </Headline>
        {hasCap && (
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <div className="w-48 h-[3px] bg-boon-charcoal/10 rounded-pill overflow-hidden">
              <div
                className="h-full bg-boon-blue rounded-pill transition-all"
                style={{ width: `${Math.min((contractSessionCount / sessionCap!) * 100, 100)}%` }}
              />
            </div>
            <Eyebrow color="muted">
              {Math.min(contractSessionCount, sessionCap!)} of {sessionCap} this contract
              {programConfig?.program_end_date && (
                <> · through {new Date(programConfig.program_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
              )}
            </Eyebrow>
          </div>
        )}
      </header>

      {/* ─────────────── Row 1: Next session (navy) + Weekly reflection (coral) ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 mb-8">
        <Card variant="navy" glow="blue" dots padding="lg">
          <Eyebrow color="coral-light">{nextSessionEyebrow}</Eyebrow>
          <h2 className="mt-4 font-display font-bold text-white text-[28px] md:text-[32px] leading-[1.15] tracking-[-0.02em]">
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
                {coachProfile?.headline || 'Your coach'}
                {sessionCountWithCoach > 0 && (
                  <> · {sessionCountWithCoach} session{sessionCountWithCoach !== 1 ? 's' : ''} together</>
                )}
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
              <Button variant="coral" size="md" onClick={() => setPrepExpanded(!prepExpanded)}>
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

        <Card variant="coral-outlined" padding="lg" accent>
          <Eyebrow color="coral">Weekly reflection</Eyebrow>
          <div className="mt-3">
            <JournalPromptCard compact />
          </div>
        </Card>
      </div>

      {/* ─────────────── Checkpoint prompt (coral-outlined) ─────────────── */}
      {checkpointStatus.isCheckpointDue && onStartCheckpoint && (
        <Card variant="coral-outlined" padding="lg" accent className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <Eyebrow color="coral">{checkpointEyebrow}</Eyebrow>
              <h2 className="mt-3 font-display font-bold text-boon-navy text-[26px] md:text-[30px] leading-[1.15] tracking-[-0.02em]">
                {checkpointStatement}{' '}
                <span className="font-serif italic font-normal text-boon-coral">
                  {checkpointKicker}
                </span>
              </h2>
              <p className="mt-3 text-sm text-boon-charcoal/75 leading-relaxed max-w-xl">
                {checkpointBody}
              </p>
              <div className="mt-6">
                <Button variant="coral" size="md" onClick={onStartCheckpoint}>
                  Start check-in
                </Button>
              </div>
            </div>
            {onDismissCheckpoint && (
              <button
                onClick={onDismissCheckpoint}
                className="p-1.5 text-boon-charcoal/40 hover:text-boon-charcoal/70 transition-colors"
                title="Remind me later"
                aria-label="Dismiss check-in reminder"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </Card>
      )}

      {/* ─────────────── Where we left off (only when no upcoming session) ─────────────── */}
      {!hasUpcomingSession && hasLeftOffContent && (
        <Card padding="lg" className="mb-8">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-7 h-7 rounded-pill bg-boon-coral/12 flex items-center justify-center text-boon-coral">
                <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </span>
              <Eyebrow color="coral">
                {currentFocus ? 'Current focus' : 'Where we left off'}
              </Eyebrow>
              {currentFocus ? (
                <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-charcoal/45">
                  · From check-in {checkpointStatus.latestCheckpoint?.checkpoint_number}
                </span>
              ) : sessionWithGoals ? (
                <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-charcoal/45">
                  · From {new Date(sessionWithGoals.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              ) : null}
            </div>
            {actionItems.length > 0 && (
              <Badge variant={completedActionCount === actionItems.length ? 'success' : 'neutral'}>
                {completedActionCount} of {actionItems.length} done
              </Badge>
            )}
          </div>

          {currentFocus ? (
            <Headline as="h3" size="md" statement={currentFocus} />
          ) : sessionWithGoals?.goals ? (
            <div>
              <Eyebrow color="muted" className="mb-3">Current goal</Eyebrow>
              <Headline as="h3" size="md" statement={sessionWithGoals.goals} />
            </div>
          ) : null}

          {actionItems.length > 0 ? (
            <div className={currentFocus || sessionWithGoals?.goals ? 'mt-7' : ''}>
              <Eyebrow color="muted" className="mb-3">Action items</Eyebrow>
              <div className="flex flex-col gap-2.5">
                {actionItems.map(item => {
                  const isCompleted = item.status === 'completed';
                  const isUpdating = updatingItem === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleToggleAction(item.id, item.status)}
                      disabled={isUpdating}
                      className={`flex items-start gap-3.5 p-3.5 rounded-btn border border-boon-charcoal/[0.08] hover:border-boon-blue/40 hover:shadow-sm transition-all text-left group ${isUpdating ? 'opacity-50' : ''} ${isCompleted ? 'bg-white/50' : 'bg-white'}`}
                      title={isCompleted ? 'Mark as pending' : 'Mark as complete'}
                    >
                      <span
                        className={`w-5 h-5 rounded-md flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                          isCompleted
                            ? 'bg-boon-blue'
                            : 'border-[1.5px] border-boon-charcoal/30 group-hover:border-boon-blue group-hover:bg-boon-blue/5'
                        }`}
                      >
                        <svg
                          className={`w-3 h-3 transition-colors ${
                            isCompleted ? 'text-white' : 'text-transparent group-hover:text-boon-blue'
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <p className={`flex-1 text-sm leading-relaxed ${isCompleted ? 'text-boon-charcoal/50 line-through' : 'text-boon-charcoal'}`}>
                        {item.action_text}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : sessionWithGoals?.plan && !currentFocus ? (
            <div className="mt-7">
              <Eyebrow color="muted" className="mb-3">Action items</Eyebrow>
              <div className="flex flex-col gap-2.5">
                {sessionWithGoals.plan.split(/[\n;]/).filter(line => line.trim()).map((item, idx) => {
                  const cleanText = item.trim().replace(/^[\s•\-\*\d\.:\)]+/, '').trim();
                  if (!cleanText || cleanText.length < 5) return null;
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-3.5 p-3.5 rounded-btn bg-white border border-boon-charcoal/[0.08]"
                    >
                      <span className="text-boon-coral text-sm leading-relaxed mt-0.5 flex-shrink-0" aria-hidden>•</span>
                      <p className="flex-1 text-sm text-boon-charcoal leading-relaxed">{cleanText}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </Card>
      )}

      {/* ─────────────── Practice nudge ─────────────── */}
      <PracticePrompt />
    </div>
  );
}
