import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useGoalData } from '../../hooks/useGoalData';
import { CheckinModal } from './CheckinModal';
import { CommitmentInput } from './CommitmentInput';

export function GoalHomeCard() {
  const navigate = useNavigate();
  const { coachingGoal, pendingActionItems, currentWeek, addCommitment, submitCheckin, loading } = useGoalData();
  const [checkinModal, setCheckinModal] = useState<'midweek' | 'endweek' | null>(null);

  // Don't render if no coaching goal or still loading
  if (loading || !coachingGoal) return null;

  const rawDay = new Date().getDay();
  const today = rawDay === 0 ? 7 : rawDay; // Treat Sunday as 7 (end of week)
  const { hasCommitment, hasMidweekCheckin, hasEndweekCheckin, commitment } = currentWeek;
  const isMidweekOrLater = today >= 3;
  const isEndweekOrLater = today >= 5;
  const midweekDue = hasCommitment && isMidweekOrLater && !hasMidweekCheckin;
  const endweekDue = hasCommitment && isEndweekOrLater && !hasEndweekCheckin;
  const allDone = hasCommitment && !midweekDue && !endweekDue;

  async function handleSetCommitment(text: string) {
    const result = await addCommitment(text);
    if (result) {
      toast.success('Commitment set for this week');
    } else {
      toast.error('Could not save commitment');
    }
  }

  async function handleCheckinSubmit(rating: number, reflectionText?: string, blockers?: string) {
    if (!commitment || !checkinModal) return;
    const result = await submitCheckin(commitment.id, checkinModal, rating, reflectionText, blockers);
    if (result) {
      toast.success(checkinModal === 'midweek' ? 'Midweek check-in saved' : 'End of week reflection saved');
      setCheckinModal(null);
    } else {
      toast.error('Could not save check-in');
    }
  }

  // Truncate goal text for the card
  const goalPreview = coachingGoal.goals.length > 120
    ? coachingGoal.goals.slice(0, 120).trim() + '...'
    : coachingGoal.goals;

  return (
    <>
      <section className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 rounded-[2rem] p-6 md:p-8 border border-blue-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-boon-blue flex items-center justify-center">
            <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-xs font-bold text-boon-blue uppercase tracking-widest">Between Sessions</span>
          <button
            onClick={() => navigate('/goals')}
            className="ml-auto text-xs font-semibold text-boon-blue hover:text-boon-darkBlue transition-colors"
          >
            View all
          </button>
        </div>

        {/* Coaching goal preview */}
        <p className="text-sm text-gray-600 font-serif leading-relaxed mb-4">{goalPreview}</p>

        {pendingActionItems.length > 0 && (
          <p className="text-xs text-gray-400 mb-4">
            {pendingActionItems.length} action item{pendingActionItems.length !== 1 ? 's' : ''} from your coach
          </p>
        )}

        {/* No commitment set yet */}
        {!hasCommitment && (
          <div>
            <p className="text-boon-text text-sm font-medium mb-3">What will you focus on this week?</p>
            <CommitmentInput goalTitle="" onSubmit={handleSetCommitment} />
          </div>
        )}

        {/* Commitment set, check-in due */}
        {hasCommitment && (midweekDue || endweekDue) && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Your commitment</p>
            <p className="text-boon-text font-medium text-sm mb-3">{commitment?.commitment_text}</p>
            <button
              onClick={() => setCheckinModal(endweekDue ? 'endweek' : 'midweek')}
              className="w-full px-5 py-3 bg-boon-blue text-white rounded-xl font-bold text-sm hover:bg-boon-darkBlue transition-all"
            >
              {endweekDue ? 'How did this week go?' : "How's it going?"}
            </button>
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${hasMidweekCheckin ? 'bg-emerald-400' : 'border-2 border-gray-300'}`} />
                <span className="text-xs text-gray-400">Midweek</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${hasEndweekCheckin ? 'bg-emerald-400' : 'border-2 border-gray-300'}`} />
                <span className="text-xs text-gray-400">End of week</span>
              </div>
            </div>
          </div>
        )}

        {/* All done for now */}
        {allDone && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Your commitment</p>
            <p className="text-boon-text font-medium text-sm mb-3">{commitment?.commitment_text}</p>
            <div className="flex items-center gap-2 text-emerald-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold">You're on track this week</span>
            </div>
          </div>
        )}
      </section>

      {checkinModal && commitment && (
        <CheckinModal
          commitmentText={commitment.commitment_text}
          checkinType={checkinModal}
          onSubmit={handleCheckinSubmit}
          onClose={() => setCheckinModal(null)}
        />
      )}
    </>
  );
}
