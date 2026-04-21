import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useGoalData } from '../../hooks/useGoalData';
import { usePortalData } from '../ProtectedLayout';
import { updateActionItemStatus } from '../../lib/dataFetcher';
import { updateActionItemNote } from '../../lib/fetchers/goalFetcher';
import { ResourceSuggestion } from '../ResourceSuggestion';
import { SCENARIOS } from '../../data/scenarios';

function findMatchingScenario(actionText: string) {
  const words = actionText.toLowerCase().split(/\s+/);
  return SCENARIOS.find(s =>
    s.tags.some(tag => words.some(w => w.length > 3 && tag.toLowerCase().includes(w)))
  ) || null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function GoalTracker() {
  const navigate = useNavigate();
  const { reloadActionItems, sessions } = usePortalData();
  const {
    loading,
    coachingGoal,
    goalHistory,
    pendingActionItems,
    reflection,
    selfProgress,
    updateReflection,
    updateSelfProgress,
  } = useGoalData();

  const [updatingItem, setUpdatingItem] = useState<string | null>(null);
  const [reflectionText, setReflectionText] = useState(reflection || '');
  const [reflectionSaved, setReflectionSaved] = useState(false);
  const reflectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Action item notes state
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [noteTexts, setNoteTexts] = useState<Record<string, string>>({});
  const [_savingNote, setSavingNote] = useState<string | null>(null);

  useEffect(() => {
    if (reflection !== null) setReflectionText(reflection);
  }, [reflection]);

  useEffect(() => {
    return () => {
      if (reflectionTimer.current) clearTimeout(reflectionTimer.current);
    };
  }, []);

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

  async function handleToggleAction(itemId: string, currentStatus: string) {
    setUpdatingItem(itemId);
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    const success = await updateActionItemStatus(itemId, newStatus);
    if (success) {
      reloadActionItems();
    }
    setUpdatingItem(null);
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto animate-fade-in">
        <div className="space-y-6">
          <div className="h-8 w-48 bg-boon-offWhite rounded-btn animate-pulse" />
          <div className="h-40 bg-boon-offWhite rounded-card animate-pulse" />
          <div className="h-32 bg-boon-offWhite rounded-card animate-pulse" />
        </div>
      </div>
    );
  }

  if (!coachingGoal) {
    return (
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
        <header className="pt-2">
          <h1 className="text-4xl font-bold text-boon-navy tracking-tight">Your Goals</h1>
        </header>
        <section className="bg-white rounded-card p-8 md:p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 bg-boon-blue/10 rounded-card flex items-center justify-center">
            <svg className="w-7 h-7 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-boon-navy mb-2">Goals will appear after your first session</h2>
          <p className="text-boon-charcoal/55 text-sm max-w-md mx-auto">
            After each coaching session, your coach will set goals and action items for you. This page helps you stay on track between sessions.
          </p>
        </section>
      </div>
    );
  }

  const recentCompleted = sessions.filter(s => s.status === 'Completed').slice(0, 3);
  const sessionThemes = {
    leadership: recentCompleted.some(s => !!s.leadership_management_skills),
    communication: recentCompleted.some(s => !!s.communication_skills),
    wellbeing: recentCompleted.some(s => !!s.mental_well_being),
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <header className="pt-2">
        <h1 className="text-4xl font-bold text-boon-navy tracking-tight">Your Goals</h1>
        <p className="text-boon-charcoal/55 mt-1">Stay on track between sessions.</p>
      </header>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* ── Left column: Goal card + Reflection ── */}
        <div className="lg:col-span-3 space-y-8">
          {/* Goal card with blue header */}
          <section className="bg-white rounded-card overflow-hidden">
            {/* Blue header */}
            <div className="bg-boon-blue text-white p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Coaching Goal</span>
                </div>
                <span className="text-xs font-medium opacity-80">
                  Started {formatDate(coachingGoal.session_date)} with {coachingGoal.coach_name.split(' ')[0]}
                </span>
              </div>
              <h2 className="text-2xl font-bold leading-tight">
                {coachingGoal.goals}
              </h2>
            </div>

            {/* Card body */}
            <div className="p-8 space-y-8">
              {coachingGoal.plan && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-boon-charcoal/55">Coach's Plan</span>
                  <p className="text-boon-charcoal/75 mt-2 leading-relaxed">{coachingGoal.plan}</p>
                </div>
              )}

              {/* Self-progress */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-boon-charcoal/55 mb-4 block">How do you feel about this goal?</span>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 'not_started', label: 'Not started yet' },
                    { value: 'working_on_it', label: 'Working on it' },
                    { value: 'feeling_confident', label: 'Feeling confident' },
                  ].map(opt => {
                    const isActive = selfProgress === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleSelfProgress(opt.value)}
                        className={`px-6 py-2 rounded-pill text-xs font-bold border transition-all ${
                          isActive
                            ? 'bg-boon-blue text-white border-blue-600'
                            : 'text-boon-charcoal/55 border-boon-charcoal/[0.08] hover:bg-boon-offWhite'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Items */}
              {pendingActionItems.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-boon-charcoal/55 mb-4 block">Action Items</span>
                  <div className="space-y-3">
                    {pendingActionItems.map(item => {
                      const isCompleted = item.status === 'completed';
                      const isUpdating = updatingItem === item.id;
                      const matchingScenario = findMatchingScenario(item.action_text);

                      return (
                        <div
                          key={item.id}
                          className={`flex items-start gap-4 p-4 bg-boon-offWhite rounded-btn border border-boon-charcoal/[0.08] hover:shadow-md transition-all ${
                            isCompleted ? 'opacity-50' : ''
                          } ${isUpdating ? 'opacity-50' : ''}`}
                        >
                          <button
                            onClick={() => handleToggleAction(item.id, item.status)}
                            disabled={isUpdating}
                            className="mt-1 w-5 h-5 rounded-pill border-2 border-boon-charcoal/[0.08] hover:border-blue-500 hover:bg-boon-blue/10 transition-all flex-shrink-0 flex items-center justify-center group"
                          >
                            <svg className="w-2.5 h-2.5 text-transparent group-hover:text-boon-blue transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <div className="flex-1">
                            <p className={`text-sm text-boon-charcoal/75 leading-relaxed ${isCompleted ? 'line-through text-boon-charcoal/55' : ''}`}>
                              {item.action_text}
                            </p>
                            {matchingScenario && !isCompleted && (
                              <button
                                onClick={() => navigate('/practice')}
                                className="mt-1 text-xs font-semibold text-boon-purple hover:text-boon-purple flex items-center gap-1"
                              >
                                Practice this
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            )}
                            {!isCompleted && (
                              <div className="mt-1">
                                {expandedNoteId === item.id ? (
                                  <div className="flex gap-2 mt-1">
                                    <input
                                      type="text"
                                      value={noteTexts[item.id] ?? item.employee_note ?? ''}
                                      onChange={(e) => setNoteTexts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                      placeholder="Add a note..."
                                      className="flex-1 px-3 py-1.5 text-xs rounded-btn border border-boon-charcoal/[0.08] focus:outline-none focus:border-blue-500"
                                      onBlur={async () => {
                                        const note = noteTexts[item.id];
                                        if (note !== undefined) {
                                          setSavingNote(item.id);
                                          await updateActionItemNote(item.id, note);
                                          setSavingNote(null);
                                        }
                                        setExpandedNoteId(null);
                                      }}
                                      autoFocus
                                    />
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setExpandedNoteId(item.id)}
                                    className="text-[10px] text-boon-charcoal/55 hover:text-boon-charcoal/55 font-medium"
                                  >
                                    {item.employee_note ? `\u{1F4DD} ${item.employee_note}` : '+ Add note'}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Resource suggestion */}
              <ResourceSuggestion sessionThemes={sessionThemes} label="Resource for this goal" />
            </div>
          </section>

          {/* Reflection */}
          <section className="bg-white rounded-card p-8">
            <div className="flex items-center gap-2 text-boon-purple mb-6">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-widest">Your Reflection</span>
              {reflectionSaved && (
                <span className="ml-auto text-xs text-boon-success font-medium flex items-center gap-1">
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
              className="w-full p-4 rounded-card border border-boon-charcoal/[0.08] bg-boon-offWhite text-sm resize-none focus:bg-white focus:outline-none focus:ring-2 focus:ring-boon-blue/20 focus:border-boon-blue transition-all min-h-[150px]"
              rows={5}
            />
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-boon-charcoal/55 italic">Your coach can see this reflection before your next session.</p>
              <button
                onClick={async () => {
                  await updateReflection(reflectionText);
                  setReflectionSaved(true);
                  setTimeout(() => setReflectionSaved(false), 2000);
                  toast.success('Reflection saved');
                }}
                className="px-8 py-2.5 bg-boon-purple hover:bg-boon-purple text-white rounded-btn text-xs font-bold transition-all"
              >
                Save
              </button>
            </div>
          </section>
        </div>

        {/* ── Right column: Goal Evolution ── */}
        <div className="lg:col-span-2 space-y-8">
          {/* Goal Evolution Timeline */}
          {goalHistory.length > 1 && (
            <section className="bg-white rounded-card overflow-hidden">
              <div className="p-6 border-b border-boon-charcoal/[0.08]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-boon-blue/10 rounded-btn flex items-center justify-center">
                    <svg className="w-5 h-5 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-bold text-boon-blue uppercase tracking-widest">Goal Evolution</span>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-6">
                  {goalHistory.slice(1, 4).map((goal, idx) => (
                    <div key={idx} className="relative pl-6 pb-6 border-l border-boon-charcoal/[0.08] last:pb-0">
                      <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-pill bg-boon-blue" />
                      <p className="text-[10px] font-bold text-boon-charcoal/55 uppercase tracking-[0.18em] mb-1">
                        {formatDate(goal.session_date)} with {goal.coach_name.split(' ')[0]}
                      </p>
                      <p className="text-sm text-boon-charcoal/75 leading-relaxed">{goal.goals}</p>
                    </div>
                  ))}
                </div>
                {goalHistory.length > 4 && (
                  <button
                    onClick={() => navigate('/goals?view=history')}
                    className="w-full mt-6 text-sm font-semibold text-boon-blue hover:text-boon-darkBlue hover:bg-boon-blue/10 rounded-btn py-2.5 transition-all flex items-center justify-center gap-1 group"
                  >
                    View Full History
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Milestone / motivation card */}
          {(() => {
            const completedCount = sessions.filter(s => s.status === 'Completed').length;
            const milestones = [3, 6, 9, 12];
            const reached = milestones.filter(t => completedCount >= t);
            const isMilestone = reached.length > 0;
            const milestone = reached[reached.length - 1];
            const milestoneMessages: Record<number, string> = {
              3: "You've consistently shown up for 3 sessions. That's real commitment.",
              6: "Halfway there! 6 sessions of focused growth.",
              9: "9 sessions in. You're building lasting habits.",
              12: "All 12 sessions complete. What a journey.",
            };

            return (
              <section className="bg-boon-navy text-white rounded-card p-8 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-white/10 rounded-card flex items-center justify-center mb-6">
                    {isMilestone ? (
                      <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )}
                  </div>
                  <h3 className="text-xl font-bold mb-2">
                    {isMilestone ? 'Milestone Reached' : 'Keep Going'}
                  </h3>
                  <p className="text-boon-charcoal/55 text-sm leading-relaxed mb-6">
                    {isMilestone
                      ? milestoneMessages[milestone]
                      : `You have ${pendingActionItems.length} action item${pendingActionItems.length !== 1 ? 's' : ''} to work on this week. Check them off as you go.`}
                  </p>
                  {isMilestone && (
                    <button className="w-full py-3 bg-boon-blue hover:bg-boon-darkBlue text-white rounded-btn text-sm font-bold transition-all">
                      Claim Badge
                    </button>
                  )}
                </div>
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-boon-blue/20 rounded-pill blur-3xl" />
              </section>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
