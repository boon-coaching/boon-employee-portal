import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useGoalData } from '../../hooks/useGoalData';
import { usePortalData } from '../ProtectedLayout';
import { updateActionItemStatus } from '../../lib/dataFetcher';
import { CommitmentInput } from './CommitmentInput';
import { CheckinModal } from './CheckinModal';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeekLabel(weekStart: string): string {
  const date = new Date(weekStart + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function GoalTracker() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { reloadActionItems } = usePortalData();
  const {
    loading,
    coachingGoal,
    goalHistory,
    pendingActionItems,
    currentWeek,
    commitments,
    addCommitment,
    submitCheckin,
    reflection,
    selfProgress,
    updateReflection,
    updateSelfProgress,
  } = useGoalData();

  const [checkinModal, setCheckinModal] = useState<'midweek' | 'endweek' | null>(null);
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [reflectionText, setReflectionText] = useState(reflection || '');
  const [reflectionSaved, setReflectionSaved] = useState(false);
  const reflectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when reflection loads
  useEffect(() => {
    if (reflection !== null) setReflectionText(reflection);
  }, [reflection]);

  function handleReflectionChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setReflectionText(text);
    setReflectionSaved(false);
    if (reflectionTimer.current) clearTimeout(reflectionTimer.current);
    reflectionTimer.current = setTimeout(async () => {
      await updateReflection(text);
      setReflectionSaved(true);
      setTimeout(() => setReflectionSaved(false), 2000);
    }, 1000);
  }

  async function handleSelfProgress(status: string) {
    await updateSelfProgress(status);
    toast.success(status === 'feeling_confident' ? 'Great progress!' : 'Updated');
  }

  // Auto-open check-in from nudge deep link
  useEffect(() => {
    const checkinParam = searchParams.get('checkin');
    if (checkinParam === 'midweek' || checkinParam === 'endweek') {
      if (currentWeek.hasCommitment) {
        setCheckinModal(checkinParam);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, currentWeek.hasCommitment, setSearchParams]);

  async function handleToggleAction(itemId: string, currentStatus: string) {
    setUpdatingItem(itemId);
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    const success = await updateActionItemStatus(itemId, newStatus);
    if (success) {
      reloadActionItems();
    }
    setUpdatingItem(null);
  }

  async function handleSetCommitment(text: string) {
    const result = await addCommitment(text);
    if (result) {
      toast.success('Commitment set for this week');
    } else {
      toast.error('Could not save commitment');
    }
  }

  async function handleCheckinSubmit(rating: number, reflectionText?: string, blockers?: string) {
    if (!currentWeek.commitment || !checkinModal) return;
    const result = await submitCheckin(currentWeek.commitment.id, checkinModal, rating, reflectionText, blockers);
    if (result) {
      toast.success(checkinModal === 'midweek' ? 'Midweek check-in saved' : 'End of week reflection saved');
      setCheckinModal(null);
    } else {
      toast.error('Could not save check-in');
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto animate-fade-in">
        <div className="space-y-6">
          <div className="h-8 w-48 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-40 bg-gray-100 rounded-[2rem] animate-pulse" />
          <div className="h-32 bg-gray-100 rounded-[2rem] animate-pulse" />
        </div>
      </div>
    );
  }

  // No coaching goal yet
  if (!coachingGoal) {
    return (
      <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
        <header className="pt-2">
          <h1 className="text-3xl md:text-4xl font-extrabold text-boon-text tracking-tight">Your Goals</h1>
        </header>
        <section className="bg-white rounded-[2rem] p-8 md:p-10 border border-gray-100 shadow-sm text-center">
          <div className="w-14 h-14 mx-auto mb-4 bg-boon-lightBlue rounded-2xl flex items-center justify-center">
            <svg className="w-7 h-7 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-boon-text mb-2">Goals will appear after your first session</h2>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            After each coaching session, your coach will set goals and action items for you. This page helps you stay on track between sessions.
          </p>
        </section>
      </div>
    );
  }

  const today = new Date().getDay();
  const isMidweekOrLater = today >= 3;
  const isEndweekOrLater = today >= 5;
  const { hasCommitment, hasMidweekCheckin, hasEndweekCheckin, commitment } = currentWeek;
  const midweekDue = hasCommitment && isMidweekOrLater && !hasMidweekCheckin;
  const endweekDue = hasCommitment && isEndweekOrLater && !hasEndweekCheckin;

  const recentCommitments = commitments.filter(c => c.id !== commitment?.id).slice(0, 6);

  return (
    <div className="max-w-3xl mx-auto space-y-8 md:space-y-10 animate-fade-in">
      <header className="pt-2">
        <h1 className="text-3xl md:text-4xl font-extrabold text-boon-text tracking-tight">Your Goals</h1>
        <p className="text-gray-500 mt-2 text-base font-medium">Stay on track between sessions</p>
      </header>

      {/* 1. Coaching Goal (from coach) */}
      <section className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 rounded-[2rem] p-6 md:p-8 border border-blue-100 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-boon-blue flex items-center justify-center">
            <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-xs font-bold text-boon-blue uppercase tracking-widest">Coaching Goal</span>
          <span className="ml-auto text-xs text-gray-400">
            {formatDate(coachingGoal.session_date)} with {coachingGoal.coach_name.split(' ')[0]}
          </span>
        </div>
        <p className="text-boon-text font-serif text-base leading-relaxed whitespace-pre-line">{coachingGoal.goals}</p>
        {coachingGoal.plan && (
          <div className="mt-4 pt-4 border-t border-blue-100/50">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Coach's Plan</p>
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{coachingGoal.plan}</p>
          </div>
        )}

        {/* Self-progress indicator */}
        <div className="mt-5 pt-5 border-t border-blue-100/50">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">How do you feel about this goal?</p>
          <div className="flex gap-2">
            {[
              { value: 'not_started', label: 'Not started yet', color: 'gray' },
              { value: 'working_on_it', label: 'Working on it', color: 'amber' },
              { value: 'feeling_confident', label: 'Feeling confident', color: 'emerald' },
            ].map(opt => {
              const isActive = selfProgress === opt.value;
              const colorMap: Record<string, string> = {
                gray: isActive ? 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300',
                amber: isActive ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-white text-gray-400 border-gray-200 hover:border-amber-300',
                emerald: isActive ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-white text-gray-400 border-gray-200 hover:border-emerald-300',
              };
              return (
                <button
                  key={opt.value}
                  onClick={() => handleSelfProgress(opt.value)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${colorMap[opt.color]}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Employee Reflection */}
      {coachingGoal && (
        <section className="bg-white rounded-[2rem] p-6 md:p-8 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Your Reflection</span>
            {reflectionSaved && (
              <span className="ml-auto text-xs text-emerald-500 font-medium flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </span>
            )}
          </div>
          <textarea
            value={reflectionText}
            onChange={handleReflectionChange}
            placeholder="How are you thinking about this goal? What's working, what's hard?"
            className="w-full p-4 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all min-h-[100px]"
            rows={4}
          />
          <p className="text-xs text-gray-400 mt-2">Your coach can see this reflection before your next session.</p>
        </section>
      )}

      {/* 2. Action Items (from coach) */}
      {pendingActionItems.length > 0 && (
        <section className="bg-white rounded-[2rem] p-6 md:p-8 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">Action Items from Your Coach</span>
          </div>
          <div className="space-y-2">
            {pendingActionItems.map(item => {
              const isCompleted = item.status === 'completed';
              const isUpdating = updatingItem === item.id;

              return (
                <label
                  key={item.id}
                  className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                    isCompleted ? 'bg-green-50/50 text-gray-400' : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                  } ${isUpdating ? 'opacity-50' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isCompleted}
                    disabled={isUpdating}
                    onChange={() => handleToggleAction(item.id, item.status)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                  />
                  <span className={`text-sm leading-relaxed ${isCompleted ? 'line-through' : ''}`}>
                    {item.action_text}
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. This Week's Commitment */}
      <section className="bg-white rounded-[2rem] p-6 md:p-8 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
            <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">This Week</span>
        </div>

        {!hasCommitment && (
          <div>
            <p className="text-boon-text text-sm mb-4">
              Based on your coaching goal, what will you focus on this week?
            </p>
            <CommitmentInput goalTitle="" onSubmit={handleSetCommitment} />
          </div>
        )}

        {hasCommitment && commitment && (
          <div>
            <p className="text-boon-text font-medium mb-4">{commitment.commitment_text}</p>

            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${hasMidweekCheckin ? 'bg-emerald-400' : 'border-2 border-gray-300'}`} />
                <span className="text-xs text-gray-500">Midweek</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${hasEndweekCheckin ? 'bg-emerald-400' : 'border-2 border-gray-300'}`} />
                <span className="text-xs text-gray-500">End of week</span>
              </div>
            </div>

            {(midweekDue || endweekDue) && (
              <button
                onClick={() => setCheckinModal(endweekDue ? 'endweek' : 'midweek')}
                className="w-full px-5 py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all"
              >
                {endweekDue ? 'How did this week go?' : "How's it going?"}
              </button>
            )}

            {!midweekDue && !endweekDue && (
              <div className="flex items-center gap-2 text-emerald-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-semibold">You're on track this week</span>
              </div>
            )}
          </div>
        )}

        {recentCommitments.length > 0 && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1.5 text-xs text-gray-400 font-medium hover:text-gray-500 transition-colors"
            >
              <svg className={`w-3 h-3 transition-transform ${showHistory ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
              Past weeks ({recentCommitments.length})
            </button>
            {showHistory && (
              <div className="mt-3 space-y-2">
                {recentCommitments.map(c => (
                  <div key={c.id} className="flex items-start gap-3 text-xs text-gray-400 py-1">
                    <span className="font-medium text-gray-300 w-16 flex-shrink-0">{formatWeekLabel(c.week_start)}</span>
                    <span className="leading-relaxed flex-1">{c.commitment_text}</span>
                    <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      c.status === 'completed' ? 'bg-emerald-50 text-emerald-500'
                        : c.status === 'partial' ? 'bg-amber-50 text-amber-500'
                        : 'bg-gray-50 text-gray-400'
                    }`}>{c.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 4. Goal History */}
      {goalHistory.length > 1 && (
        <section className="bg-white rounded-[2rem] p-6 md:p-8 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-purple-500 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs font-bold text-purple-600 uppercase tracking-widest">How Your Goals Have Evolved</span>
          </div>
          <div className="space-y-4">
            {goalHistory.slice(1).map((goal, idx) => (
              <div key={idx} className="pl-4 border-l-2 border-purple-100">
                <p className="text-xs text-gray-400 mb-1">{formatDate(goal.session_date)} with {goal.coach_name.split(' ')[0]}</p>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{goal.goals}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {checkinModal && commitment && (
        <CheckinModal
          commitmentText={commitment.commitment_text}
          checkinType={checkinModal}
          onSubmit={handleCheckinSubmit}
          onClose={() => setCheckinModal(null)}
        />
      )}
    </div>
  );
}
