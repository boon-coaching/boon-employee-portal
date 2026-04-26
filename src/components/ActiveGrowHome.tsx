import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Card, Headline, Button, Avatar, Badge } from '../lib/design-system';
import type { Employee, Session, ActionItem, BaselineSurvey, Coach } from '../lib/types';
import type { CoachingStateData } from '../lib/coachingState';
import { COUNTED_SESSION_STATUSES, isUpcomingSession } from '../lib/coachingState';
import { supabase } from '../lib/supabase';
import { fetchCoachByName, updateActionItemStatus } from '../lib/dataFetcher';
import { PracticePrompt } from './PracticePrompt';
import { JournalPromptCard } from './journal/JournalPromptCard';
import SessionPrep from './SessionPrep';

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

function formatRelative(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ActiveGrowHomeProps {
  profile: Employee | null;
  sessions: Session[];
  actionItems: ActionItem[];
  baseline: BaselineSurvey | null;
  coachingState: CoachingStateData;
  onActionUpdate: () => void;
  userEmail: string;
}

export default function ActiveGrowHome({
  profile,
  sessions,
  actionItems,
  coachingState,
  onActionUpdate,
  userEmail,
}: ActiveGrowHomeProps) {
  const [updatingActionId, setUpdatingActionId] = useState<string | null>(null);
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

  const sessionCountWithCoach = sessions.filter(
    s => COUNTED_SESSION_STATUSES.includes(s.status) && s.coach_name === coachName
  ).length;

  const pendingActions = actionItems.filter(a => a.status === 'pending');
  const recentlyCompletedActions = actionItems.filter(a => {
    if (a.status !== 'completed') return false;
    if (!a.completed_at) return false;
    const daysSinceCompletion = (Date.now() - new Date(a.completed_at).getTime()) / (1000 * 60 * 60 * 24);
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

  // Editorial hero. EXEC + GROW share the cohort arc, so copy mirrors
  // GrowDashboard's progress-aware kickers.
  const completedCount = coachingState.completedSessionCount || 0;
  const knownTotal = coachingState.totalExpectedSessions && coachingState.totalExpectedSessions > 0
    ? coachingState.totalExpectedSessions
    : null;
  const numberWord = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  const countAsWord = completedCount >= 0 && completedCount < numberWord.length
    ? numberWord[completedCount]
    : String(completedCount);
  const capitalize = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;

  let heroStatement: string;
  let heroKicker: string;
  if (completedCount === 0) {
    heroStatement = 'Before the first.';
    heroKicker = 'Where you begin.';
  } else if (knownTotal && completedCount >= knownTotal - 2) {
    heroStatement = 'The home stretch.';
    heroKicker = `${capitalize(countAsWord)} in.`;
  } else if (knownTotal && completedCount >= Math.ceil(knownTotal / 2)) {
    heroStatement = `Session ${countAsWord}.`;
    heroKicker = 'The middle stretch.';
  } else {
    heroStatement = `Session ${countAsWord}.`;
    heroKicker = 'Still building.';
  }

  const momentumLabel = (() => {
    if (completedCount === 0) return 'JUST STARTING';
    if (completedCount < 3) return 'EARLY STEPS';
    if (!knownTotal) return 'IN PROGRESS';
    if (completedCount < Math.ceil(knownTotal / 2)) return 'BUILDING MOMENTUM';
    if (completedCount < knownTotal - 2) return 'MID-STRETCH';
    return 'HOME STRETCH';
  })();

  const progressPct = knownTotal ? Math.min((completedCount / knownTotal) * 100, 100) : null;

  const hasUpcomingSession = !!upcomingSession;

  const nextSessionTopic = upcomingSession?.goals?.trim() || null;
  const nextSessionStatement = nextSessionTopic
    ? nextSessionTopic
    : hasUpcomingSession
    ? 'The next conversation.'
    : 'Not yet scheduled.';
  const nextSessionKicker = hasUpcomingSession
    ? `With ${coachFirstName}.`
    : `Book with ${coachFirstName}.`;

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

  // Pre-session reflection. Auto-saves to session_prep so the coach can read
  // intent before the call; unique to this Home variant (Grow uses the
  // weekly journal in this slot).
  const [reflection, setReflection] = useState('');
  const [isSavingReflection, setIsSavingReflection] = useState(false);
  const [reflectionSavedAt, setReflectionSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    const loadReflection = async () => {
      if (!upcomingSession || !userEmail) return;
      try {
        const { data, error } = await supabase
          .from('session_prep')
          .select('intention')
          .eq('email', userEmail.toLowerCase())
          .eq('session_id', upcomingSession.id)
          .single();
        if (!error && data) setReflection(data.intention || '');
      } catch {
        const key = `session_prep_${userEmail}_${upcomingSession.id}`;
        const saved = localStorage.getItem(key);
        if (saved) setReflection(saved);
      }
    };
    loadReflection();
  }, [upcomingSession, userEmail]);

  const saveReflection = useCallback(async (text: string) => {
    if (!upcomingSession || !userEmail) return;
    setIsSavingReflection(true);
    const key = `session_prep_${userEmail}_${upcomingSession.id}`;
    localStorage.setItem(key, text);
    try {
      const { error } = await supabase
        .from('session_prep')
        .upsert(
          {
            email: userEmail.toLowerCase(),
            session_id: upcomingSession.id,
            intention: text,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email,session_id' }
        );
      if (!error) setReflectionSavedAt(new Date());
    } catch {
      // localStorage already updated; silent fallback
    }
    setIsSavingReflection(false);
  }, [upcomingSession, userEmail]);

  // Skip the first save echo from the load effect — only persist user edits.
  const [reflectionDirty, setReflectionDirty] = useState(false);
  useEffect(() => {
    if (!reflectionDirty || !reflection) return;
    const timer = setTimeout(() => saveReflection(reflection), 1000);
    return () => clearTimeout(timer);
  }, [reflection, reflectionDirty, saveReflection]);

  const actionsDone = recentlyCompletedActions.length;
  const actionsTotal = pendingActions.length + recentlyCompletedActions.length;
  const [showAllActions, setShowAllActions] = useState(false);
  const MAX_ACTIONS = 3;
  const visiblePending = showAllActions ? pendingActions : pendingActions.slice(0, MAX_ACTIONS);
  const visibleCompleted = showAllActions ? recentlyCompletedActions : [];
  const hiddenActionCount = (pendingActions.length - visiblePending.length) + recentlyCompletedActions.length;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-32 md:pb-0">
      {/* ─────────────── Editorial hero ─────────────── */}
      <header className="pb-6 mb-6 border-b border-boon-charcoal/10">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="w-6 h-px bg-boon-blue" aria-hidden />
          <Eyebrow color="blue">Your progress</Eyebrow>
          {knownTotal ? (
            <Eyebrow color="muted">· {completedCount} of {knownTotal} with {coachFirstName}</Eyebrow>
          ) : completedCount > 0 ? (
            <Eyebrow color="muted">· {completedCount} session{completedCount === 1 ? '' : 's'} with {coachFirstName}</Eyebrow>
          ) : null}
          <Eyebrow color="coral">· {momentumLabel}</Eyebrow>
        </div>
        <Headline as="h1" size="lg">
          {heroStatement}{' '}
          <Headline.Kicker color="blue">{heroKicker}</Headline.Kicker>
        </Headline>
        {progressPct !== null && (
          <div className="mt-5 flex items-center gap-3">
            <div className="w-48 h-[3px] bg-boon-charcoal/10 rounded-pill overflow-hidden">
              <div
                className="h-full bg-boon-blue rounded-pill transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <Eyebrow color="muted">{Math.round(progressPct)}% complete</Eyebrow>
          </div>
        )}
      </header>

      {/* ─────────────── Row 1: Next Session (navy) + Reflection (coral) ─────────────── */}
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
                {coachProfile?.headline || 'Your coach'} · {sessionCountWithCoach} session{sessionCountWithCoach !== 1 ? 's' : ''} together
              </div>
            </div>
          </div>
          <div className="mt-7 flex items-center gap-3 flex-wrap">
            {joinableZoomLink ? (
              <Button as="a" href={joinableZoomLink} target="_blank" rel="noopener noreferrer" variant="coral" size="md">
                Join session
              </Button>
            ) : hasUpcomingSession ? (
              <Button variant="coral" size="md" onClick={() => setPrepExpanded(!prepExpanded)}>
                {prepExpanded ? 'Hide prep' : 'Open prep'}
              </Button>
            ) : profile?.booking_link ? (
              <Button as="a" href={profile.booking_link} target="_blank" rel="noopener noreferrer" variant="coral" size="md">
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

        {hasUpcomingSession ? (
          <Card variant="coral-outlined" padding="lg" accent>
            <Eyebrow color="coral">Before you meet</Eyebrow>
            <textarea
              value={reflection}
              onChange={e => { setReflection(e.target.value); setReflectionDirty(true); }}
              placeholder={`Share what's on your mind. ${coachFirstName} will see this before your session.`}
              className="mt-4 w-full p-3 rounded-btn bg-white border border-boon-charcoal/[0.12] focus:border-boon-coral focus:outline-none text-sm leading-relaxed min-h-[120px] resize-none placeholder:text-boon-charcoal/40"
            />
            <div className="mt-2 h-4 flex items-center text-[11px] font-extrabold uppercase tracking-[0.14em]">
              {isSavingReflection && <span className="text-boon-charcoal/45">Saving</span>}
              {!isSavingReflection && reflectionSavedAt && (
                <span className="text-boon-coral">Saved {formatRelative(reflectionSavedAt)}</span>
              )}
            </div>
          </Card>
        ) : (
          <Card variant="coral-outlined" padding="lg" accent>
            <Eyebrow color="coral">Weekly reflection</Eyebrow>
            <div className="mt-3">
              <JournalPromptCard compact />
            </div>
          </Card>
        )}
      </div>

      {/* ─────────────── Row 2: Where we left off ─────────────── */}
      {(lastSession?.goals || pendingActions.length > 0 || recentlyCompletedActions.length > 0) && (
        <Card padding="lg" className="mb-8">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-7 h-7 rounded-pill bg-boon-coral/12 flex items-center justify-center text-boon-coral">
                <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </span>
              <Eyebrow color="coral">Where we left off</Eyebrow>
              {lastSession && (
                <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-charcoal/45">
                  · From {new Date(lastSession.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
            {actionsTotal > 0 && actionsDone > 0 && (
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

          {(pendingActions.length > 0 || recentlyCompletedActions.length > 0) && (
            <div>
              <Eyebrow color="muted" className="mb-3">Action items</Eyebrow>
              <div className="flex flex-col gap-2.5">
                {visiblePending.map(action => {
                  const isUpdating = updatingActionId === action.id;
                  return (
                    <button
                      key={action.id}
                      onClick={() => handleCompleteAction(action.id)}
                      disabled={isUpdating}
                      className={`flex items-start gap-3.5 p-3.5 rounded-btn bg-white border border-boon-charcoal/[0.08] hover:border-boon-blue/40 hover:shadow-sm transition-all text-left group ${isUpdating ? 'opacity-50' : ''}`}
                      title="Mark as complete"
                    >
                      <span className="w-5 h-5 rounded-md border-[1.5px] border-boon-charcoal/30 group-hover:border-boon-blue group-hover:bg-boon-blue/5 transition-all flex-shrink-0 mt-0.5 flex items-center justify-center">
                        <svg className="w-3 h-3 text-transparent group-hover:text-boon-blue transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <p className="flex-1 text-sm text-boon-charcoal leading-relaxed">{action.action_text}</p>
                    </button>
                  );
                })}
                {visibleCompleted.map(action => (
                  <div
                    key={action.id}
                    className="flex items-start gap-3.5 p-3.5 rounded-btn bg-white/50 border border-boon-charcoal/[0.06]"
                  >
                    <span className="w-5 h-5 rounded-md bg-boon-blue flex-shrink-0 mt-0.5 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <p className="flex-1 text-sm text-boon-charcoal/50 leading-relaxed line-through">{action.action_text}</p>
                  </div>
                ))}
              </div>
              {hiddenActionCount > 0 && (
                <button
                  onClick={() => setShowAllActions(true)}
                  className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-boon-blue hover:text-boon-darkBlue transition-colors"
                >
                  + {hiddenActionCount} more
                </button>
              )}
              {showAllActions && (pendingActions.length > MAX_ACTIONS || recentlyCompletedActions.length > 0) && (
                <button
                  onClick={() => setShowAllActions(false)}
                  className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-boon-charcoal/55 hover:text-boon-charcoal transition-colors"
                >
                  Show less
                </button>
              )}
            </div>
          )}
        </Card>
      )}

      <PracticePrompt />
    </div>
  );
}
