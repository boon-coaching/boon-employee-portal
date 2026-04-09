import { useState } from 'react';
import { toast } from 'sonner';
import { useGoalData } from '../../hooks/useGoalData';
import { CommitmentInput } from './CommitmentInput';
import { CheckinModal } from './CheckinModal';

export function WeeklyCommitmentSection() {
  const { currentWeek, addCommitment, submitCheckin, loading, coachingGoal } = useGoalData();
  const [checkinModal, setCheckinModal] = useState<'midweek' | 'endweek' | null>(null);

  if (loading || !coachingGoal) return null;

  const rawDay = new Date().getDay();
  const today = rawDay === 0 ? 7 : rawDay;
  const { hasCommitment, hasMidweekCheckin, hasEndweekCheckin, commitment } = currentWeek;
  const isMidweekOrLater = today >= 3;
  const isEndweekOrLater = today >= 5;
  const midweekDue = hasCommitment && isMidweekOrLater && !hasMidweekCheckin;
  const endweekDue = hasCommitment && isEndweekOrLater && !hasEndweekCheckin;

  async function handleSetCommitment(text: string) {
    const result = await addCommitment(text);
    if (result) toast.success('Commitment set for this week');
    else toast.error('Could not save commitment');
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

  return (
    <>
      <div className="pt-4 mt-4 border-t border-boon-amber/10">
        {!hasCommitment && (
          <>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">This Week's Focus</p>
            <CommitmentInput onSubmit={handleSetCommitment} />
          </>
        )}

        {hasCommitment && commitment && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">This Week's Focus</p>
                <p className="text-sm text-boon-text">{commitment.commitment_text}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 pt-4">
                <div className={`w-2.5 h-2.5 rounded-full ${hasMidweekCheckin ? 'bg-emerald-400' : 'border-2 border-gray-300'}`} />
                <div className={`w-2.5 h-2.5 rounded-full ${hasEndweekCheckin ? 'bg-emerald-400' : 'border-2 border-gray-300'}`} />
              </div>
            </div>
            {(midweekDue || endweekDue) && (
              <button
                onClick={() => setCheckinModal(endweekDue ? 'endweek' : 'midweek')}
                className="mt-3 w-full px-4 py-2.5 bg-boon-blue text-white rounded-xl font-bold text-xs hover:bg-boon-darkBlue transition-all"
              >
                {endweekDue ? 'How did this week go?' : "How's it going?"}
              </button>
            )}
          </>
        )}
      </div>

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
