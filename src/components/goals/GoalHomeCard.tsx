import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useGoalData } from '../../hooks/useGoalData';
import { CheckinModal } from './CheckinModal';
export function GoalHomeCard() {
  const navigate = useNavigate();
  const { goals, currentWeek, addCommitment, submitCheckin, loading } = useGoalData();
  const [commitmentText, setCommitmentText] = useState('');
  const [saving, setSaving] = useState(false);
  const [checkinModal, setCheckinModal] = useState<'midweek' | 'endweek' | null>(null);

  if (loading || goals.length === 0) return null;

  const today = new Date().getDay(); // 0=Sun, 1=Mon, ...
  const activeGoals = goals.filter(g => g.status === 'active');
  if (activeGoals.length === 0) return null;

  const { hasCommitment, hasMidweekCheckin, hasEndweekCheckin, commitment } = currentWeek;

  // Determine what to show
  const isMidweekOrLater = today >= 3; // Wednesday+
  const isEndweekOrLater = today >= 5; // Friday+
  const midweekDue = hasCommitment && isMidweekOrLater && !hasMidweekCheckin;
  const endweekDue = hasCommitment && isEndweekOrLater && !hasEndweekCheckin;
  const allDone = hasCommitment && ((isEndweekOrLater && hasEndweekCheckin) || (!isEndweekOrLater && isMidweekOrLater && hasMidweekCheckin) || (!isMidweekOrLater));

  async function handleSetCommitment() {
    if (!commitmentText.trim() || activeGoals.length === 0) return;
    setSaving(true);
    const result = await addCommitment(activeGoals[0].id, commitmentText.trim());
    setSaving(false);
    if (result) {
      toast.success('Commitment set for this week');
      setCommitmentText('');
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

  return (
    <>
      <section className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 rounded-[2rem] p-6 md:p-8 border border-blue-100 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-boon-blue flex items-center justify-center">
            <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-boon-blue uppercase tracking-widest">This Week's Goal</span>
          </div>
          <button
            onClick={() => navigate('/goals')}
            className="ml-auto text-xs font-semibold text-boon-blue hover:text-boon-darkBlue transition-colors"
          >
            View all
          </button>
        </div>

        {/* No commitment set yet */}
        {!hasCommitment && (
          <div>
            <p className="text-boon-text font-medium mb-3">What will you focus on this week?</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={commitmentText}
                onChange={(e) => setCommitmentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetCommitment()}
                placeholder="e.g., Practice giving direct feedback in 1:1s"
                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-boon-text placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-boon-blue/20 focus:border-boon-blue transition-all"
                disabled={saving}
              />
              <button
                onClick={handleSetCommitment}
                disabled={saving || !commitmentText.trim()}
                className="px-5 py-2.5 bg-boon-blue text-white rounded-xl font-bold text-sm hover:bg-boon-darkBlue transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Set'}
              </button>
            </div>
          </div>
        )}

        {/* Commitment set, check-in due */}
        {hasCommitment && (midweekDue || endweekDue) && (
          <div>
            <p className="text-sm text-gray-500 mb-1">Your commitment</p>
            <p className="text-boon-text font-medium mb-4">{commitment?.commitment_text}</p>
            <button
              onClick={() => setCheckinModal(endweekDue ? 'endweek' : 'midweek')}
              className="w-full px-5 py-3 bg-boon-blue text-white rounded-xl font-bold text-sm hover:bg-boon-darkBlue transition-all"
            >
              {endweekDue ? 'How did this week go?' : "How's it going?"}
            </button>
            {/* Check-in progress dots */}
            <div className="flex items-center gap-3 mt-4">
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
        {hasCommitment && allDone && !midweekDue && !endweekDue && (
          <div>
            <p className="text-sm text-gray-500 mb-1">Your commitment</p>
            <p className="text-boon-text font-medium mb-3">{commitment?.commitment_text}</p>
            <div className="flex items-center gap-2 text-emerald-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold">You're on track this week</span>
            </div>
            {/* Check-in progress dots */}
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
      </section>

      {/* Check-in modal */}
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
