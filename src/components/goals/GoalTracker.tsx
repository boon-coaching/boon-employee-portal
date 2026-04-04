import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useGoalData } from '../../hooks/useGoalData';
import { COMPETENCY_TAG_LABELS } from '../../lib/types';
import { GoalCard } from './GoalCard';
import { CheckinModal } from './CheckinModal';

export default function GoalTracker() {
  const {
    loading,
    error,
    goals,
    commitments,
    checkins,
    currentWeek,
    addGoal,
    addCommitment,
    submitCheckin,
    reload,
  } = useGoalData();

  const [searchParams, setSearchParams] = useSearchParams();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCompetency, setNewCompetency] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [checkinModal, setCheckinModal] = useState<{
    open: boolean;
    type: 'midweek' | 'endweek';
    commitmentId: string;
    commitmentText: string;
  } | null>(null);

  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');

  useEffect(() => {
    const checkinParam = searchParams.get('checkin');
    if (
      (checkinParam === 'midweek' || checkinParam === 'endweek') &&
      currentWeek.commitment
    ) {
      setCheckinModal({
        open: true,
        type: checkinParam,
        commitmentId: currentWeek.commitment.id,
        commitmentText: currentWeek.commitment.commitment_text,
      });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, currentWeek.commitment, setSearchParams]);

  async function handleAddGoal() {
    if (!newTitle.trim()) return;
    setSaving(true);
    const result = await addGoal(
      newTitle.trim(),
      undefined,
      newCompetency || undefined,
    );
    if (result) {
      toast.success('Goal added');
      setNewTitle('');
      setNewCompetency('');
      setShowAddForm(false);
    } else {
      toast.error('Could not add goal');
    }
    setSaving(false);
  }

  async function handleSetCommitment(goalId: string, text: string) {
    const result = await addCommitment(goalId, text);
    if (result) {
      toast.success('Commitment set for this week');
      await reload();
    } else {
      toast.error('Could not set commitment');
    }
  }

  function handleCheckinClick(commitmentId: string) {
    const commitment = commitments.find(c => c.id === commitmentId);
    if (!commitment) return;

    const type = currentWeek.hasMidweekCheckin ? 'endweek' : 'midweek';
    setCheckinModal({
      open: true,
      type,
      commitmentId,
      commitmentText: commitment.commitment_text,
    });
  }

  async function handleCheckinSubmit(
    rating: number,
    reflectionText?: string,
    blockers?: string,
  ) {
    if (!checkinModal) return;
    const result = await submitCheckin(
      checkinModal.commitmentId,
      checkinModal.type,
      rating,
      reflectionText,
      blockers,
    );
    if (result) {
      toast.success(
        checkinModal.type === 'midweek'
          ? 'Midweek check-in saved'
          : 'End of week reflection saved',
      );
      setCheckinModal(null);
      await reload();
    } else {
      toast.error('Could not save check-in');
    }
  }

  if (loading) {
    return (
      <div className="animate-fade-in p-6 md:p-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="h-8 w-48 bg-gray-100 rounded-xl animate-pulse" />
          <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm space-y-4">
            <div className="h-5 w-64 bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-4 w-full bg-gray-50 rounded-lg animate-pulse" />
            <div className="h-4 w-3/4 bg-gray-50 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in p-6 md:p-10">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm text-center">
            <p className="text-red-500 font-medium mb-4">{error}</p>
            <button
              onClick={() => reload()}
              className="px-6 py-2.5 bg-boon-blue text-white rounded-xl font-bold text-sm hover:bg-boon-darkBlue transition-all"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const thisWeekCommitment = currentWeek.commitment;
  const thisWeekGoal = thisWeekCommitment
    ? goals.find(g => g.id === thisWeekCommitment.goal_id)
    : null;

  return (
    <div className="animate-fade-in p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-boon-text">Your Goals</h1>
            <p className="text-gray-400 text-sm mt-1">
              Set goals, make weekly commitments, and track your progress.
            </p>
          </div>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-2.5 bg-boon-blue text-white rounded-xl font-bold text-sm hover:bg-boon-darkBlue transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Goal
            </button>
          )}
        </div>

        {/* Add Goal Inline Form */}
        {showAddForm && (
          <div className="bg-white rounded-[2rem] p-6 md:p-8 border-2 border-boon-blue/20 shadow-sm">
            <h3 className="text-sm font-bold text-boon-text mb-4">New Goal</h3>
            <div className="space-y-4">
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="What do you want to work on?"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-boon-text placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-boon-blue/30 focus:border-boon-blue transition-all text-sm"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddGoal();
                  }
                }}
              />
              <select
                value={newCompetency}
                onChange={e => setNewCompetency(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-boon-text focus:outline-none focus:ring-2 focus:ring-boon-blue/30 focus:border-boon-blue transition-all text-sm"
              >
                <option value="">Competency area (optional)</option>
                {Object.entries(COMPETENCY_TAG_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewTitle('');
                    setNewCompetency('');
                  }}
                  className="px-5 py-2.5 text-gray-400 font-bold text-sm hover:text-gray-600 transition-colors rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddGoal}
                  disabled={saving || !newTitle.trim()}
                  className="px-6 py-2.5 bg-boon-blue text-white rounded-xl font-bold text-sm hover:bg-boon-darkBlue transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Goal'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* This Week Section */}
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-7 h-7 rounded-lg bg-boon-lightBlue flex items-center justify-center">
              <svg className="w-4 h-4 text-boon-blue" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </span>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">This Week</h2>
          </div>

          {thisWeekCommitment ? (
            <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-gray-100 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {thisWeekGoal && (
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
                      {thisWeekGoal.title}
                    </p>
                  )}
                  <p className="text-boon-text font-medium leading-relaxed">
                    {thisWeekCommitment.commitment_text}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() =>
                      !currentWeek.hasMidweekCheckin &&
                      handleCheckinClick(thisWeekCommitment.id)
                    }
                    title="Midweek check-in"
                    className="group"
                  >
                    <span
                      className={`block w-4 h-4 rounded-full border-2 transition-all ${
                        currentWeek.hasMidweekCheckin
                          ? 'bg-emerald-400 border-emerald-400'
                          : 'border-gray-300 group-hover:border-boon-blue'
                      }`}
                    />
                  </button>
                  <button
                    onClick={() =>
                      currentWeek.hasMidweekCheckin &&
                      !currentWeek.hasEndweekCheckin &&
                      handleCheckinClick(thisWeekCommitment.id)
                    }
                    title="End of week reflection"
                    className="group"
                  >
                    <span
                      className={`block w-4 h-4 rounded-full border-2 transition-all ${
                        currentWeek.hasEndweekCheckin
                          ? 'bg-emerald-400 border-emerald-400'
                          : 'border-gray-300 group-hover:border-boon-blue'
                      }`}
                    />
                  </button>
                </div>
              </div>
              {!currentWeek.hasMidweekCheckin && (
                <button
                  onClick={() => handleCheckinClick(thisWeekCommitment.id)}
                  className="mt-4 text-sm text-boon-blue font-bold hover:underline"
                >
                  Complete midweek check-in →
                </button>
              )}
              {currentWeek.hasMidweekCheckin && !currentWeek.hasEndweekCheckin && (
                <button
                  onClick={() => handleCheckinClick(thisWeekCommitment.id)}
                  className="mt-4 text-sm text-boon-blue font-bold hover:underline"
                >
                  Complete end of week reflection →
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-gray-100 shadow-sm text-center">
              <p className="text-gray-400 text-sm mb-1">No commitment set for this week.</p>
              <p className="text-gray-300 text-xs">
                Pick an active goal below and set a weekly commitment to get started.
              </p>
            </div>
          )}
        </section>

        {/* Active Goals Section */}
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-7 h-7 rounded-lg bg-boon-lightBlue flex items-center justify-center">
              <svg className="w-4 h-4 text-boon-blue" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </span>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Active Goals</h2>
          </div>

          {activeGoals.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-gray-100 shadow-sm text-center">
              <p className="text-gray-400 text-sm">
                No active goals yet. Add a goal to start tracking your growth.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeGoals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  commitments={commitments.filter(c => c.goal_id === goal.id)}
                  checkins={checkins}
                  onSetCommitment={handleSetCommitment}
                  onCheckin={handleCheckinClick}
                />
              ))}
            </div>
          )}
        </section>

        {/* Completed Goals Section */}
        {completedGoals.length > 0 && (
          <section>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-2.5 mb-4 group"
            >
              <span className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Completed ({completedGoals.length})
              </h2>
              <svg
                className={`w-4 h-4 text-gray-300 transition-transform ${showCompleted ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {showCompleted && (
              <div className="space-y-4">
                {completedGoals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    commitments={commitments.filter(c => c.goal_id === goal.id)}
                    checkins={checkins}
                    onSetCommitment={handleSetCommitment}
                    onCheckin={handleCheckinClick}
                    isReadOnly
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Check-in Modal */}
      {checkinModal?.open && (
        <CheckinModal
          commitmentText={checkinModal.commitmentText}
          checkinType={checkinModal.type}
          onSubmit={handleCheckinSubmit}
          onClose={() => setCheckinModal(null)}
        />
      )}
    </div>
  );
}
