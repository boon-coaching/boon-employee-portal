import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useGoalData } from '../../hooks/useGoalData';
import { usePortalData } from '../ProtectedLayout';
import { updateActionItemStatus } from '../../lib/dataFetcher';
import { CheckinModal } from './CheckinModal';
import { CommitmentInput } from './CommitmentInput';

export function GoalHomeCard() {
  const navigate = useNavigate();
  const { coachingGoal, pendingActionItems, currentWeek, addCommitment, submitCheckin, loading } = useGoalData();
  const { reloadActionItems } = usePortalData();
  const [checkinModal, setCheckinModal] = useState<'midweek' | 'endweek' | null>(null);
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);

  if (loading || !coachingGoal) return null;

  const rawDay = new Date().getDay();
  const today = rawDay === 0 ? 7 : rawDay;
  const { hasCommitment, hasMidweekCheckin, hasEndweekCheckin, commitment } = currentWeek;
  const isMidweekOrLater = today >= 3;
  const isEndweekOrLater = today >= 5;
  const midweekDue = hasCommitment && isMidweekOrLater && !hasMidweekCheckin;
  const endweekDue = hasCommitment && isEndweekOrLater && !hasEndweekCheckin;

  async function handleToggleAction(itemId: string, currentStatus: string) {
    setUpdatingItem(itemId);
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    await updateActionItemStatus(itemId, newStatus);
    reloadActionItems();
    setUpdatingItem(null);
  }

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
      <section className="bg-white rounded-card p-5 md:p-6 border border-boon-charcoal/[0.08] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-boon-blue uppercase tracking-widest">Between Sessions</span>
          <button
            onClick={() => navigate('/goals')}
            className="text-xs font-semibold text-boon-blue hover:text-boon-darkBlue transition-colors"
          >
            View all
          </button>
        </div>

        {/* Action items: the primary interaction */}
        {pendingActionItems.length > 0 && (
          <div className="mb-4">
            <div className="space-y-1">
              {pendingActionItems.slice(0, 5).map(item => {
                const isUpdating = updatingItem === item.id;
                return (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 p-2.5 rounded-btn cursor-pointer transition-all hover:bg-boon-offWhite ${isUpdating ? 'opacity-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={false}
                      disabled={isUpdating}
                      onChange={() => handleToggleAction(item.id, item.status)}
                      className="mt-0.5 w-4 h-4 rounded border-boon-charcoal/[0.08] text-boon-blue focus:ring-boon-blue"
                    />
                    <span className="text-sm text-boon-navy leading-relaxed">{item.action_text}</span>
                  </label>
                );
              })}
            </div>
            {pendingActionItems.length > 5 && (
              <button onClick={() => navigate('/goals')} className="text-xs text-boon-charcoal/55 mt-2 hover:text-boon-blue transition-colors">
                +{pendingActionItems.length - 5} more
              </button>
            )}
          </div>
        )}

        {/* Weekly commitment */}
        {!hasCommitment && (
          <div className="pt-3 border-t border-boon-charcoal/[0.08]">
            <p className="text-[11px] font-extrabold text-boon-charcoal/55 uppercase tracking-[0.18em] mb-2">This week's focus</p>
            <CommitmentInput onSubmit={handleSetCommitment} />
          </div>
        )}

        {hasCommitment && commitment && (
          <div className="pt-3 border-t border-boon-charcoal/[0.08]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-extrabold text-boon-charcoal/55 uppercase tracking-[0.18em] mb-1">This week's focus</p>
                <p className="text-sm text-boon-navy">{commitment.commitment_text}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 pt-4">
                <div className={`w-2.5 h-2.5 rounded-pill ${hasMidweekCheckin ? 'bg-emerald-400' : 'border-2 border-boon-charcoal/[0.08]'}`} />
                <div className={`w-2.5 h-2.5 rounded-pill ${hasEndweekCheckin ? 'bg-emerald-400' : 'border-2 border-boon-charcoal/[0.08]'}`} />
              </div>
            </div>
            {(midweekDue || endweekDue) && (
              <button
                onClick={() => setCheckinModal(endweekDue ? 'endweek' : 'midweek')}
                className="mt-3 w-full px-4 py-2.5 bg-boon-blue text-white rounded-btn font-bold text-xs hover:bg-boon-darkBlue transition-all"
              >
                {endweekDue ? 'How did this week go?' : "How's it going?"}
              </button>
            )}
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
