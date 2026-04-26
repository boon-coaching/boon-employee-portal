import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, Headline, Badge, Button } from '../lib/design-system';
import type { SurveyResponse, BaselineSurvey, WelcomeSurveyScale, CoachingWin } from '../lib/types';

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};
import { isAlumniState, isPreFirstSession, isPendingReflectionState, isUpcomingSession } from '../lib/coachingState';
import { usePortalData } from './ProtectedLayout';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';

// Props interface removed - component now uses usePortalData()

// Filter out non-substantive free-text answers (test entries, dismissive responses)
const NON_ANSWERS = ['no', 'n/a', 'na', 'none', 'nope', 'nothing', 'test', 'asdf', 'xxx'];
function isSubstantiveText(text: string | null | undefined): text is string {
  if (!text?.trim()) return false;
  const normalized = text.trim().toLowerCase();
  if (normalized.length < 3) return false;
  return !NON_ANSWERS.includes(normalized);
}

// Baseline welcome survey (Typeform) stores competency scores on a 1-10 scale,
// but the portal uses a 1-5 scale. Normalize by dividing by 2 and rounding.
function normalizeBaselineScore(value: number | null): number | null {
  if (value === null) return null;
  if (value <= 5) return value; // Already on 1-5 scale (native survey)
  return Math.round(value / 2);
}

// The 12 competencies with their database column keys
const COMPETENCIES = [
  { key: 'adaptability_and_resilience', label: 'Adaptability & Resilience', shortLabel: 'Adaptability' },
  { key: 'building_relationships_at_work', label: 'Building Relationships', shortLabel: 'Relationships' },
  { key: 'change_management', label: 'Change Management', shortLabel: 'Change Mgmt' },
  { key: 'delegation_and_accountability', label: 'Delegation & Accountability', shortLabel: 'Delegation' },
  { key: 'effective_communication', label: 'Effective Communication', shortLabel: 'Communication' },
  { key: 'effective_planning_and_execution', label: 'Planning & Execution', shortLabel: 'Planning' },
  { key: 'emotional_intelligence', label: 'Emotional Intelligence', shortLabel: 'EQ' },
  { key: 'giving_and_receiving_feedback', label: 'Giving & Receiving Feedback', shortLabel: 'Feedback' },
  { key: 'persuasion_and_influence', label: 'Persuasion & Influence', shortLabel: 'Influence' },
  { key: 'self_confidence_and_imposter_syndrome', label: 'Self Confidence', shortLabel: 'Confidence' },
  { key: 'strategic_thinking', label: 'Strategic Thinking', shortLabel: 'Strategic' },
  { key: 'time_management_and_productivity', label: 'Time Management', shortLabel: 'Time Mgmt' },
];

// Map competency_scores.competency_name to our keys
function mapCompetencyName(name: string): string {
  return name.toLowerCase().replace(/ /g, '_').replace(/&/g, 'and');
}


// Get bar color based on score
function getBarColor(score: number): string {
  if (score >= 4) return '#6CD893'; // boon-success — excelling/mastering
  if (score >= 3) return '#466FF6'; // boon-blue — applying
  if (score >= 2) return '#F59E0B'; // boon-warning — developing
  return '#FF6D6A'; // boon-coral — early
}

// Boon benchmark averages for SCALE users (1-10 scale)
const BOON_BENCHMARKS = {
  satisfaction: 6.8,
  productivity: 6.9,
  work_life_balance: 6.2,
};

export default function ProgressPage() {
  const portalData = usePortalData();
  const navigate = useNavigate();
  const progress = portalData.progress;
  const baseline = portalData.baseline;
  const welcomeSurveyScale = portalData.welcomeSurveyScale;
  const competencyScores = portalData.competencyScores;
  const sessions = portalData.sessions;
  const actionItems = portalData.effectiveActionItems;
  const programType = portalData.programType;
  const coachingState = portalData.coachingState;
  const onStartReflection = portalData.handleStartReflection;
  const _checkpoints = portalData.checkpoints || [];
  const onStartCheckpoint = portalData.handleStartCheckpoint;
  const coachingWins = portalData.coachingWins || [];
  const onAddWin = portalData.handleAddWin;
  const onDeleteWin = portalData.handleDeleteWin;
  const onUpdateWin = portalData.handleUpdateWin;
  const onNavigate = (view: string) => navigate(`/${view === 'dashboard' ? '' : view}`);
  const [activeTab, setActiveTab] = useState<'competencies' | 'wellbeing'>('competencies');
  // Get latest checkpoint with wellbeing data (Session 6+)
  const latestWellbeingCheckpoint = _checkpoints
    .filter(cp => cp.wellbeing_satisfaction !== null || cp.wellbeing_productivity !== null || cp.wellbeing_balance !== null)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;
  const [showAddWinModal, setShowAddWinModal] = useState(false);
  const [newWinText, setNewWinText] = useState('');
  const [isSubmittingWin, setIsSubmittingWin] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  // Edit/delete win state
  const [editingWinId, setEditingWinId] = useState<string | null>(null);
  const [editWinText, setEditWinText] = useState('');
  const [deletingWinId, setDeletingWinId] = useState<string | null>(null);

  const handleDeleteWin = async (winId: string) => {
    if (!onDeleteWin) return;
    setDeletingWinId(winId);
    await onDeleteWin(winId);
    toast('Coaching win removed');
    setDeletingWinId(null);
  };

  const handleStartEdit = (win: CoachingWin) => {
    setEditingWinId(win.id);
    setEditWinText(win.win_text);
  };

  const handleCancelEdit = () => {
    setEditingWinId(null);
    setEditWinText('');
  };

  const handleSaveEdit = async () => {
    if (!onUpdateWin || !editingWinId || !editWinText.trim()) return;
    const success = await onUpdateWin(editingWinId, editWinText.trim());
    if (success) {
      toast.success('Coaching win updated');
      setEditingWinId(null);
      setEditWinText('');
    } else {
      toast.error('Could not update coaching win');
    }
  };

  const handleAddWin = async () => {
    devLog('[Progress] handleAddWin called', { newWinText: newWinText.trim(), hasOnAddWin: !!onAddWin });
    if (!newWinText.trim() || !onAddWin) {
      devLog('[Progress] handleAddWin early return - text empty or no onAddWin');
      return;
    }
    setIsSubmittingWin(true);
    try {
      const success = await onAddWin(newWinText.trim());
      devLog('[Progress] onAddWin result:', success);
      if (success) {
        toast.success('Coaching win saved');
        setNewWinText('');
        setShowAddWinModal(false);
      } else {
        toast.error('Could not save coaching win');
      }
    } catch (err) {
      console.error('[Progress] handleAddWin error:', err);
      toast.error('Could not save coaching win');
    } finally {
      setIsSubmittingWin(false);
    }
  };

  const completedSessions = sessions.filter(s => s.status === 'Completed');
  const completedActions = actionItems.filter(a => a.status === 'completed');

  const isGrowOrExec = programType === 'GROW' || programType === 'EXEC';
  // SCALE detection: either explicit programType OR has welcomeSurveyScale data
  const isScale = programType === 'SCALE' || (programType === null && !!welcomeSurveyScale);
  const isCompleted = isAlumniState(coachingState.state);
  const isPreFirst = isPreFirstSession(coachingState.state);
  const isPendingReflection = isPendingReflectionState(coachingState.state);

  // Get coach name for pre-first-session messaging
  // Get the NEAREST upcoming session (sort by date ascending, take first)
  const upcomingSession = sessions
    .filter(isUpcomingSession)
    .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())[0] || null;
  const anySessionWithCoach = sessions.find(s => s.coach_name);
  const coachName = upcomingSession?.coach_name || anySessionWithCoach?.coach_name;
  const coachFirstName = coachName?.split(' ')[0] || 'your coach';

  // Pre-first-session: Show different content for SCALE vs GROW
  if (isPreFirst) {
    devLog('[Progress] 🔍 Pre-first-session state detected');
    devLog('[Progress] programType:', programType, '| isScale:', isScale);
    devLog('[Progress] welcomeSurveyScale:', welcomeSurveyScale ? 'EXISTS' : 'NULL');
    if (welcomeSurveyScale) {
      devLog('[Progress] welcomeSurveyScale data:', {
        satisfaction: welcomeSurveyScale.satisfaction,
        productivity: welcomeSurveyScale.productivity,
        work_life_balance: welcomeSurveyScale.work_life_balance,
        additional_topics: welcomeSurveyScale.additional_topics,
      });
    }
    devLog('[Progress] Will show SCALE view?', isScale && !!welcomeSurveyScale);

    // SCALE pre-first-session: Show "Your Coaching Journey" with baseline metrics
    if (isScale && welcomeSurveyScale) {
      // Calculate % vs Boon average for each metric
      const calculateVsBenchmark = (value: number | null | undefined, benchmark: number) => {
        if (!value) return null;
        const diff = ((value - benchmark) / benchmark) * 100;
        return Math.round(diff);
      };

      const wellbeingMetrics = [
        {
          key: 'satisfaction',
          label: 'Satisfaction',
          value: welcomeSurveyScale.satisfaction,
          benchmark: BOON_BENCHMARKS.satisfaction,
        },
        {
          key: 'productivity',
          label: 'Productivity',
          value: welcomeSurveyScale.productivity,
          benchmark: BOON_BENCHMARKS.productivity,
        },
        {
          key: 'work_life_balance',
          label: 'Work/Life Balance',
          value: welcomeSurveyScale.work_life_balance,
          benchmark: BOON_BENCHMARKS.work_life_balance,
        },
      ];

      // Get coaching goals from welcomeSurveyScale (filter out test/non-substantive entries)
      const coachingGoal = [welcomeSurveyScale.coaching_goals, welcomeSurveyScale.additional_topics].find(isSubstantiveText) || null;

      // Format session date for display
      const sessionDate = upcomingSession?.session_date
        ? new Date(upcomingSession.session_date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          }) + ' at ' + new Date(upcomingSession.session_date).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })
        : null;

      // Coach info for timeline - use full name from any session
      const coachFullName = coachName || 'Your Coach';

      return (
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <header className="text-center">
            <h1 className="font-display font-bold text-boon-navy text-[36px] leading-[1.05] tracking-[-0.025em]">Your Coaching Journey</h1>
            <p className="text-boon-charcoal/55 mt-2 font-medium">Here's what you're working toward</p>
          </header>

          {/* What You Want to Work On - Dark card */}
          <section className="bg-gradient-to-br from-boon-navyDeep to-boon-navy rounded-card p-8 text-white">
            <p className="text-[11px] font-extrabold text-boon-charcoal/55 uppercase tracking-[0.18em] mb-4">What You Want to Work On</p>
            <div className="mb-4">
              <span className="text-2xl">🎯</span>
            </div>
            {coachingGoal ? (
              <>
                <p className="text-xl font-bold leading-relaxed mb-4">
                  "{coachingGoal}"
                </p>
                <p className="text-boon-charcoal/55 text-sm">
                  You'll refine this with your coach in your first session
                </p>
              </>
            ) : (
              <p className="text-boon-charcoal/55">
                You'll define your goals in your first session with {coachFirstName}
              </p>
            )}
          </section>

          {/* Your Journey - Timeline */}
          <section className="bg-white rounded-card p-8 border border-boon-charcoal/[0.08]">
            <h2 className="text-lg font-extrabold text-boon-navy mb-6">Your Journey</h2>

            <div className="space-y-0">
              {/* Welcome Survey - Completed */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-pill bg-boon-success flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="w-0.5 h-12 bg-boon-success"></div>
                </div>
                <div className="pb-8">
                  <h3 className="font-bold text-boon-navy">Welcome Survey</h3>
                  <p className="text-sm text-boon-charcoal/55">Shared your goals and baseline</p>
                </div>
              </div>

              {/* Matched with Coach - Completed */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-pill bg-boon-success flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="w-0.5 h-12 bg-boon-success"></div>
                </div>
                <div className="pb-8">
                  <h3 className="font-bold text-boon-navy">Matched with Your Coach</h3>
                  <p className="text-sm text-boon-charcoal/55">{coachFullName}</p>
                </div>
              </div>

              {/* First Session - Current */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-pill bg-boon-blue flex items-center justify-center">
                    <div className="w-3 h-3 rounded-pill bg-white"></div>
                  </div>
                  <div className="w-0.5 h-12 bg-boon-offWhite"></div>
                </div>
                <div className="pb-8">
                  <h3 className="font-bold text-boon-blue">First Session</h3>
                  <p className="text-sm text-boon-charcoal/55">Dive deeper into your goals and build your plan</p>
                  <span className="inline-block mt-2 px-3 py-1 bg-boon-lightBlue text-boon-blue text-xs font-bold rounded-pill">
                    You're here
                  </span>
                </div>
              </div>

              {/* Ongoing Coaching - Future */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-pill bg-boon-offWhite flex items-center justify-center">
                    <div className="w-3 h-3 rounded-pill bg-boon-charcoal/55"></div>
                  </div>
                  <div className="w-0.5 h-12 bg-boon-offWhite"></div>
                </div>
                <div className="pb-8">
                  <h3 className="font-bold text-boon-charcoal/55">Ongoing Coaching</h3>
                  <p className="text-sm text-boon-charcoal/55">Regular sessions + check-ins on your progress</p>
                </div>
              </div>

              {/* Wins & Breakthroughs - Future */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-pill bg-boon-offWhite flex items-center justify-center">
                    <div className="w-3 h-3 rounded-pill bg-boon-charcoal/55"></div>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-boon-charcoal/55">Wins & Breakthroughs</h3>
                  <p className="text-sm text-boon-charcoal/55">Celebrate what you've accomplished</p>
                </div>
              </div>
            </div>
          </section>

          {/* Your Wins */}
          {coachingWins.length > 0 ? (
            <section className="bg-boon-coral/12 rounded-card p-8 border border-boon-charcoal/[0.08]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏆</span>
                  <h2 className="text-lg font-extrabold text-boon-navy">Your Wins</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-boon-charcoal/75 bg-white px-3 py-1.5 rounded-pill border border-boon-charcoal/[0.08]">
                    {coachingWins.length} breakthrough{coachingWins.length !== 1 ? 's' : ''}
                  </span>
                  {(
                    <button
                      onClick={() => setShowAddWinModal(true)}
                      className="text-sm font-bold text-white bg-boon-coral hover:bg-boon-coralLight px-4 py-1.5 rounded-pill transition-colors"
                    >
                      + Add a win
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                {coachingWins.map((win) => (
                  <div key={win.id} className="bg-boon-warning/12 rounded-btn p-5 border-l-4 border-boon-coral group relative">
                    {editingWinId === win.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={editWinText}
                          onChange={(e) => setEditWinText(e.target.value)}
                          className="w-full p-3 border border-boon-charcoal/[0.08] rounded-btn text-sm resize-none focus:outline-none focus:ring-2 focus:ring-boon-coral"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="px-3 py-1.5 bg-boon-coral text-white text-xs font-bold rounded-btn hover:bg-boon-coralLight"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1.5 bg-boon-offWhite text-boon-charcoal/75 text-xs font-bold rounded-btn hover:bg-boon-charcoal/20"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-boon-navy italic text-lg leading-relaxed pr-16">"{win.win_text}"</p>
                        <div className="flex items-center gap-3 mt-3 text-sm text-boon-charcoal/55">
                          {win.session_number && (
                            <span className="bg-white px-3 py-1 rounded-pill border border-boon-charcoal/[0.08]">
                              Session {win.session_number}
                            </span>
                          )}
                          <span>
                            {new Date(win.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        {/* Edit/Delete buttons */}
                        {(
                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            {(
                              <button
                                onClick={() => handleStartEdit(win)}
                                className="p-1.5 text-boon-charcoal/55 hover:text-boon-charcoal/75 hover:bg-white rounded"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                            )}
                            {(
                              <button
                                onClick={() => handleDeleteWin(win.id)}
                                disabled={deletingWinId === win.id}
                                className="p-1.5 text-boon-charcoal/55 hover:text-boon-error hover:bg-white rounded disabled:opacity-50"
                                title="Delete"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="bg-boon-coral/12 rounded-card p-8 border border-boon-charcoal/[0.08]">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-btn bg-boon-warning/12 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-boon-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-boon-navy mb-2">What counts as a win?</h2>
                  <p className="text-sm text-boon-charcoal/75 leading-relaxed mb-4">
                    A difficult conversation you handled well. Feedback you gave or received. A new habit that stuck. A boundary you set. No win is too small.
                  </p>
                  {(
                    <button
                      onClick={() => setShowAddWinModal(true)}
                      className="text-sm font-bold text-boon-coral hover:text-boon-lightCoral transition-colors"
                    >
                      + Add your first win
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Add Win Modal */}
          {showAddWinModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-card p-6 w-full max-w-md shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🏆</span>
                  <h3 className="text-lg font-extrabold text-boon-navy">Add a Win</h3>
                </div>
                <p className="text-sm text-boon-charcoal/55 mb-4">
                  What breakthrough or accomplishment would you like to celebrate?
                </p>
                <textarea
                  value={newWinText}
                  onChange={(e) => setNewWinText(e.target.value)}
                  placeholder="e.g., Had a difficult conversation that went well, got positive feedback, set a boundary..."
                  className="w-full p-4 border border-boon-charcoal/[0.08] rounded-btn text-sm resize-none focus:outline-none focus:ring-2 focus:ring-boon-coral focus:border-transparent"
                  rows={4}
                  maxLength={500}
                  autoFocus
                />
                <div className="flex justify-between items-center mt-2 mb-4">
                  <span className="text-xs text-boon-charcoal/55">{newWinText.length}/500</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowAddWinModal(false);
                      setNewWinText('');
                    }}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-boon-charcoal/75 bg-boon-offWhite hover:bg-boon-offWhite rounded-btn transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddWin}
                    disabled={!newWinText.trim() || isSubmittingWin}
                    className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-boon-coral hover:bg-boon-coralLight disabled:bg-boon-charcoal/20 disabled:cursor-not-allowed rounded-btn transition-colors"
                  >
                    {isSubmittingWin ? 'Saving...' : 'Save Win'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Your Starting Point - Metric cards */}
          <section className="bg-white rounded-card p-8 border border-boon-charcoal/[0.08]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-extrabold text-boon-navy">Your Starting Point</h2>
              <span className="text-xs text-boon-charcoal/55">From welcome survey</span>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              {wellbeingMetrics.map(metric => {
                const vsBenchmark = calculateVsBenchmark(metric.value, metric.benchmark);
                return (
                  <div key={metric.key} className="text-center p-4 bg-boon-offWhite rounded-card">
                    <div className="text-3xl font-black text-boon-navy">
                      {metric.value ?? '·'}
                      <span className="text-base font-normal text-boon-charcoal/55">/10</span>
                    </div>
                    <p className="text-xs text-boon-charcoal/55 mt-1">{metric.label}</p>
                    {vsBenchmark !== null && (
                      <p className={`text-xs font-bold mt-1 ${vsBenchmark >= 0 ? 'text-boon-success' : 'text-boon-error'}`}>
                        {vsBenchmark >= 0 ? '+' : ''}{vsBenchmark}% vs avg
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-center text-sm text-boon-charcoal/55 border-t border-boon-charcoal/[0.08] pt-4">
              We'll check in on these periodically to see how things evolve
            </p>
          </section>

          {/* You're all set - CTA */}
          {upcomingSession && (
            <section className="bg-boon-blue rounded-card p-8 text-center text-white">
              <h2 className="text-xl font-extrabold mb-2">You're all set</h2>
              <p className="text-blue-100 mb-6">
                Your first session is scheduled. The real work begins soon.
              </p>
              {sessionDate && (
                <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/20 rounded-btn">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="font-bold">{sessionDate}</span>
                </div>
              )}
            </section>
          )}
        </div>
      );
    }

    // Build baseline competency data for pre-first-session display
    const baselineCompetencyData = COMPETENCIES.map(comp => {
      const baselineKey = `comp_${comp.key}` as keyof BaselineSurvey;
      const rawValue = baseline?.[baselineKey] as number | null;
      return {
        key: comp.key,
        label: comp.label,
        shortLabel: comp.shortLabel,
        baseline: normalizeBaselineScore(rawValue) ?? 0,
      };
    });

    // Check if we have any baseline competency data
    const hasBaselineCompetencies = baselineCompetencyData.some(c => c.baseline > 0);

    // GROW/EXEC pre-first-session: Show baseline competencies if available
    return (
      <div className="space-y-8 animate-fade-in pb-32 md:pb-0">
        <header className="pb-6 border-b border-boon-charcoal/10">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="w-6 h-px bg-boon-blue" aria-hidden />
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-blue">Progress</span>
          </div>
          <h1 className="font-display font-bold text-boon-navy tracking-[-0.025em] leading-[1.05] text-[36px] md:text-[44px]">
            Where you're <span className="font-serif italic font-normal text-boon-coral">starting</span>.
          </h1>
        </header>

        {/* Hero Section */}
        <section className="bg-boon-offWhite rounded-card p-10 md:p-14 border border-boon-charcoal/[0.08] text-center">
          <div className="w-20 h-20 mx-auto mb-8 bg-boon-coral/10 rounded-pill flex items-center justify-center">
            <svg className="w-10 h-10 text-boon-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="font-display font-bold text-boon-navy tracking-[-0.02em] leading-[1.15] text-2xl md:text-3xl mb-4">
            Your leadership <span className="font-serif italic font-normal">profile</span>.
          </h2>
          <p className="text-boon-charcoal/75 text-lg max-w-lg mx-auto leading-relaxed">
            {hasBaselineCompetencies
              ? `Here's where you're starting. The shape changes as you work with ${coachFirstName}.`
              : `Your profile takes shape as you work with ${coachFirstName}.`
            }
          </p>
        </section>

        {/* Baseline Competencies Grid */}
        {hasBaselineCompetencies && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-extrabold text-boon-navy">Your Starting Point</h2>
              <span className="text-xs text-boon-charcoal/55">From your welcome survey</span>
            </div>
            <p className="text-xs text-boon-charcoal/55 mb-4">
              Scores reflect where you are today, from Learning (1) to Mastering (5). Most people start at 2-3.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {baselineCompetencyData.filter(c => c.baseline > 0).map(comp => (
                <div
                  key={comp.key}
                  className="bg-white p-5 rounded-card border border-boon-charcoal/[0.08]"
                >
                  <h3 className="font-bold text-boon-navy text-sm leading-tight mb-4">{comp.label}</h3>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-boon-charcoal/55 uppercase tracking-wide">Baseline</span>
                      <span className="font-bold text-boon-coral">{comp.baseline}/5</span>
                    </div>
                    <div className="h-2 bg-boon-offWhite rounded-pill overflow-hidden">
                      <div
                        className="h-full bg-boon-coral rounded-pill transition-all duration-500"
                        style={{ width: `${(comp.baseline) * 20}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Wellbeing Baseline */}
        {baseline && (baseline.satisfaction || baseline.productivity || baseline.work_life_balance || baseline.motivation) && (
          <section className="bg-boon-offWhite rounded-card p-6 border border-boon-charcoal/[0.08]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-boon-charcoal/75">Wellbeing Baseline</h3>
              <span className="text-[10px] text-boon-charcoal/55">From welcome survey</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[
                { key: 'satisfaction', label: 'Satisfaction', value: baseline.satisfaction, benchmark: BOON_BENCHMARKS.satisfaction },
                { key: 'productivity', label: 'Productivity', value: baseline.productivity, benchmark: BOON_BENCHMARKS.productivity },
                { key: 'work_life_balance', label: 'Balance', value: baseline.work_life_balance, benchmark: BOON_BENCHMARKS.work_life_balance },
                { key: 'motivation', label: 'Motivation', value: baseline.motivation, benchmark: null },
              ].map((metric) => {
                const vsBenchmark = metric.benchmark && metric.value
                  ? Math.round(((metric.value - metric.benchmark) / metric.benchmark) * 100)
                  : null;
                return (
                  <div key={metric.key} className="text-center">
                    <p className="text-xl font-bold text-boon-navy">
                      {metric.value || '·'}<span className="text-sm text-boon-charcoal/55">/10</span>
                    </p>
                    <p className="text-[10px] font-bold text-boon-charcoal/55 uppercase tracking-widest">{metric.label}</p>
                    {vsBenchmark !== null && (
                      <p className={`text-xs font-bold mt-1 ${vsBenchmark >= 0 ? 'text-boon-success' : 'text-boon-error'}`}>
                        {vsBenchmark >= 0 ? '+' : ''}{vsBenchmark}% vs avg
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* What to Expect */}
        <section className="bg-white rounded-card p-8 border border-boon-charcoal/[0.08]">
          <h3 className="text-lg font-extrabold text-boon-navy mb-6">What You'll Track</h3>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-boon-coral/10 rounded-btn flex items-center justify-center">
                <svg className="w-6 h-6 text-boon-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h4 className="font-bold text-boon-navy text-sm mb-2">12 Competencies</h4>
              <p className="text-boon-charcoal/55 text-xs">Leadership skills like communication, delegation, and emotional intelligence.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-green-100 rounded-btn flex items-center justify-center">
                <svg className="w-6 h-6 text-boon-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h4 className="font-bold text-boon-navy text-sm mb-2">Growth Trends</h4>
              <p className="text-boon-charcoal/55 text-xs">Visual comparisons between your baseline and current levels.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-boon-lightBlue rounded-btn flex items-center justify-center">
                <svg className="w-6 h-6 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h4 className="font-bold text-boon-navy text-sm mb-2">Wellbeing Metrics</h4>
              <p className="text-boon-charcoal/55 text-xs">Track satisfaction, productivity, balance, and motivation over time.</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // SCALE: Redesigned view focused on goals, journey, and wins
  if (isScale) {
    // Calculate time in program
    const firstSession = completedSessions.length > 0 ? completedSessions[completedSessions.length - 1] : null;
    const monthsInProgram = firstSession
      ? Math.max(1, Math.floor((Date.now() - new Date(firstSession.session_date).getTime()) / (1000 * 60 * 60 * 24 * 30)))
      : 0;

    // Get coaching goals from welcomeSurveyScale - priority: additional_topics (their own words) > selected focus areas
    const focusLabels: Record<string, string> = {
      'focus_leadership_development': 'Leadership Development',
      'focus_work_life_balance': 'Work/Life Balance',
      'focus_work_performance': 'Work Performance',
      'focus_work_relationships': 'Work Relationships',
      'focus_work_stress': 'Managing Work Stress',
      'focus_new_environment': 'Navigating a New Environment',
      'focus_adapting_to_change': 'Adapting to Change',
      'focus_dealing_with_uncertainty': 'Dealing with Uncertainty',
      'focus_bouncing_back': 'Building Resilience',
      'focus_relationship_with_self': 'Relationship with Self',
      'focus_inner_confidence': 'Inner Confidence',
      'focus_positive_habits': 'Building Positive Habits',
      'focus_personal_accountability': 'Personal Accountability',
      'focus_professional_development': 'Professional Growth',
      'focus_persevering_through_change': 'Persevering Through Change',
      'focus_relationships_self_others': 'Relationships with Self & Others',
      'focus_coping_stress_anxiety': 'Coping with Stress & Anxiety',
      'focus_realizing_potential': 'Realizing Your Potential',
    };

    // Get goal display - prefer their own words, fall back to selected focus areas
    // Filters out non-substantive entries (test data, dismissive answers)
    const getGoalDisplay = () => {
      if (isSubstantiveText(welcomeSurveyScale?.additional_topics)) {
        return { type: 'text' as const, content: welcomeSurveyScale!.additional_topics! };
      }
      if (isSubstantiveText(welcomeSurveyScale?.coaching_goals)) {
        return { type: 'text' as const, content: welcomeSurveyScale!.coaching_goals! };
      }
      // Get selected focus areas
      const selectedFocusAreas = Object.entries(focusLabels)
        .filter(([field]) => welcomeSurveyScale?.[field as keyof WelcomeSurveyScale])
        .map(([, label]) => label);
      if (selectedFocusAreas.length > 0) {
        return { type: 'list' as const, content: selectedFocusAreas };
      }
      return null;
    };

    const goalDisplay = getGoalDisplay();
    const goalDate = welcomeSurveyScale?.created_at
      ? new Date(welcomeSurveyScale.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : null;

    // Calculate wellbeing metrics vs benchmark
    const calculateVsBenchmark = (value: number | null | undefined, benchmark: number) => {
      if (!value) return null;
      const diff = ((value - benchmark) / benchmark) * 100;
      return Math.round(diff);
    };

    const wellbeingMetrics = [
      {
        key: 'satisfaction',
        label: 'Satisfaction',
        value: welcomeSurveyScale?.satisfaction,
        benchmark: BOON_BENCHMARKS.satisfaction,
      },
      {
        key: 'productivity',
        label: 'Productivity',
        value: welcomeSurveyScale?.productivity,
        benchmark: BOON_BENCHMARKS.productivity,
      },
      {
        key: 'work_life_balance',
        label: 'Work/Life Balance',
        value: welcomeSurveyScale?.work_life_balance,
        benchmark: BOON_BENCHMARKS.work_life_balance,
      },
    ];

    // Check-in schedule: 1, 3, 6, 12, 18, 24, etc.
    const checkInSchedule = [1, 3, 6, 12, 18, 24, 30, 36];
    const nextCheckInSession = checkInSchedule.find(n => n > completedSessions.length) || (completedSessions.length + 6);

    // Build journey timeline steps
    const journeySteps: Array<{ key: string; label: string; detail: string; completed: boolean; isCurrent?: boolean }> = [
      {
        key: 'welcome',
        label: 'Welcome Survey',
        detail: 'Shared your goals and baseline',
        completed: true
      },
      {
        key: 'matched',
        label: 'Matched with Coach',
        detail: coachName || 'Your Coach',
        completed: true
      },
    ];

    // Add completed sessions
    completedSessions.slice().reverse().forEach((session, idx) => {
      const sessionNum = idx + 1;
      journeySteps.push({
        key: `session-${sessionNum}`,
        label: `Session ${sessionNum}`,
        detail: `Completed ${new Date(session.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        completed: true,
      });
    });

    // Add next step (upcoming session or schedule prompt)
    const nextSessionNum = completedSessions.length + 1;
    if (upcomingSession) {
      journeySteps.push({
        key: `session-${nextSessionNum}`,
        label: `Session ${nextSessionNum}`,
        detail: `${new Date(upcomingSession.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${new Date(upcomingSession.session_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
        completed: false,
        isCurrent: !coachingState.scaleCheckpointStatus.isCheckpointDue,
      });
    } else {
      journeySteps.push({
        key: `session-${nextSessionNum}`,
        label: `Session ${nextSessionNum}`,
        detail: 'Schedule your next session',
        completed: false,
        isCurrent: !coachingState.scaleCheckpointStatus.isCheckpointDue,
      });
    }

    // Add future milestones
    journeySteps.push(
      { key: 'ongoing', label: 'Ongoing Coaching', detail: 'Continue your growth', completed: false },
      { key: 'wins', label: 'Wins & Breakthroughs', detail: 'Celebrate your progress', completed: false }
    );

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <header className="text-center">
          <h1 className="font-display font-bold text-boon-navy text-[36px] leading-[1.05] tracking-[-0.025em]">Your Coaching Journey</h1>
          <p className="text-boon-charcoal/55 mt-2 font-medium">Here's what you're working toward</p>
        </header>

        {/* Check-in Due Banner - Priority CTA */}
        {coachingState.scaleCheckpointStatus.isCheckpointDue && (
          <section className="bg-boon-coral/10 rounded-card p-6 border-2 border-boon-charcoal/[0.08]">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-boon-coral/20 rounded-btn flex items-center justify-center">
                  <svg className="w-6 h-6 text-boon-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-boon-navy">Complete your check-in</h2>
                  <p className="text-sm text-boon-charcoal/75">Reflect on your progress and set your focus for upcoming sessions.</p>
                </div>
              </div>
              <button
                onClick={onStartCheckpoint}
                className="px-6 py-3 bg-boon-coral text-white font-bold rounded-btn hover:bg-boon-coral transition-all"
              >
                Start Check-In
              </button>
            </div>
          </section>
        )}

        {/* Your Goal - Hero Card */}
        <section className="bg-gradient-to-br from-boon-navyDeep to-boon-navy rounded-card p-8 text-white">
          <div className="flex items-start justify-between mb-4">
            <p className="text-[11px] font-extrabold text-boon-charcoal/55 uppercase tracking-widest">What You Want to Work On</p>
            {goalDate && (
              <span className="text-[10px] text-boon-charcoal/55">{goalDate}</span>
            )}
          </div>
          <div className="mb-4">
            <span className="text-2xl">🎯</span>
          </div>
          {goalDisplay ? (
            goalDisplay.type === 'text' ? (
              <>
                <p className="text-xl font-bold leading-relaxed mb-4">
                  "{goalDisplay.content}"
                </p>
                <p className="text-boon-charcoal/55 text-sm">
                  Refine this with your coach anytime
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  {(goalDisplay.content as string[]).map((area, idx) => (
                    <span key={idx} className="px-3 py-1.5 bg-white/10 rounded-btn text-sm font-medium">
                      {area}
                    </span>
                  ))}
                </div>
                <p className="text-boon-charcoal/55 text-sm">
                  Refine these focus areas with your coach anytime
                </p>
              </>
            )
          ) : (
            <p className="text-boon-charcoal/55">
              Your goals will be refined with your coach
            </p>
          )}
        </section>

        {/* Session Stats - Compact */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-card border border-boon-charcoal/[0.08] text-center">
            <p className="text-2xl font-black text-boon-navy">{completedSessions.length}</p>
            <p className="text-[10px] font-bold text-boon-charcoal/55 uppercase tracking-widest mt-1">Sessions completed</p>
          </div>
          <div className="bg-white p-5 rounded-card border border-boon-charcoal/[0.08] text-center">
            <p className="text-2xl font-black text-boon-navy">{monthsInProgram > 0 ? monthsInProgram : '·'}</p>
            <p className="text-[10px] font-bold text-boon-charcoal/55 uppercase tracking-widest mt-1">Months in coaching</p>
          </div>
          <div className="bg-white p-5 rounded-card border border-boon-charcoal/[0.08] text-center">
            <p className="text-2xl font-black text-boon-charcoal/55">Session {nextCheckInSession}</p>
            <p className="text-[10px] font-bold text-boon-charcoal/55 uppercase tracking-widest mt-1">Next check-in</p>
          </div>
        </div>

        {/* Wellbeing Progress - Baseline vs Current */}
        {welcomeSurveyScale && (welcomeSurveyScale.satisfaction || welcomeSurveyScale.productivity || welcomeSurveyScale.work_life_balance) && (
          <section className="bg-boon-offWhite rounded-card p-6 border border-boon-charcoal/[0.08]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-boon-charcoal/75">
                {latestWellbeingCheckpoint ? 'Your Wellbeing Progress' : 'Your Starting Point'}
              </h3>
              <span className="text-[10px] text-boon-charcoal/55">
                {latestWellbeingCheckpoint
                  ? `Updated Session ${latestWellbeingCheckpoint.checkpoint_number}`
                  : 'From welcome survey · Check-in every 6 sessions'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {wellbeingMetrics.map((metric) => {
                const baselineValue = metric.value;
                const currentValue = latestWellbeingCheckpoint
                  ? (metric.key === 'satisfaction' ? latestWellbeingCheckpoint.wellbeing_satisfaction
                    : metric.key === 'productivity' ? latestWellbeingCheckpoint.wellbeing_productivity
                    : latestWellbeingCheckpoint.wellbeing_balance)
                  : null;
                const hasUpdate = currentValue !== null;
                const improvement = hasUpdate && baselineValue ? currentValue - baselineValue : null;

                return (
                  <div key={metric.key} className="text-center">
                    {hasUpdate ? (
                      <>
                        {/* Current score - prominent */}
                        <p className="text-xl font-bold text-boon-navy">
                          {currentValue}<span className="text-sm text-boon-charcoal/55">/10</span>
                        </p>
                        <p className="text-[10px] font-bold text-boon-charcoal/55 uppercase tracking-widest">{metric.label}</p>
                        {/* Show improvement from baseline */}
                        {improvement !== null && improvement !== 0 && (
                          <p className={`text-xs font-bold mt-1 ${improvement > 0 ? 'text-boon-success' : 'text-boon-warning'}`}>
                            {improvement > 0 ? '↑' : '↓'} {Math.abs(improvement)} from baseline
                          </p>
                        )}
                        {improvement === 0 && (
                          <p className="text-xs text-boon-charcoal/55 mt-1">
                            Same as baseline ({baselineValue})
                          </p>
                        )}
                        {/* Baseline reference */}
                        <p className="text-[10px] text-boon-charcoal/55 mt-0.5">
                          Baseline: {baselineValue}/10
                        </p>
                      </>
                    ) : (
                      <>
                        {/* Only baseline - original display */}
                        <p className="text-xl font-bold text-boon-navy">
                          {baselineValue || '·'}<span className="text-sm text-boon-charcoal/55">/10</span>
                        </p>
                        <p className="text-[10px] font-bold text-boon-charcoal/55 uppercase tracking-widest">{metric.label}</p>
                        {(() => {
                          const vsBenchmark = calculateVsBenchmark(baselineValue, metric.benchmark);
                          return vsBenchmark !== null ? (
                            <p className={`text-xs mt-1 ${vsBenchmark >= 0 ? 'text-boon-success' : 'text-boon-warning'}`}>
                              {vsBenchmark >= 0 ? '+' : ''}{vsBenchmark}% vs avg
                            </p>
                          ) : null;
                        })()}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Your Journey - Timeline (collapsible) */}
        <section className="bg-white rounded-card p-8 border border-boon-charcoal/[0.08]">
          <h2 className="text-lg font-extrabold text-boon-navy mb-6">Your Journey</h2>
          <div className="space-y-0">
            {(() => {
              // Split journey steps for collapsible rendering
              const milestoneSteps = journeySteps.filter(s => s.key === 'welcome' || s.key === 'matched');
              const sessionSteps = journeySteps.filter(s => s.key.startsWith('session-') && s.completed);
              const remainingSteps = journeySteps.filter(s =>
                s.key !== 'welcome' && s.key !== 'matched' &&
                !(s.key.startsWith('session-') && s.completed)
              );
              const shouldCollapse = sessionSteps.length > 5 && !timelineExpanded;

              const renderStep = (step: typeof journeySteps[0], isLast: boolean) => {
                const isCurrent = step.isCurrent;
                return (
                  <div key={step.key} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-pill flex items-center justify-center ${
                        step.completed
                          ? 'bg-boon-success'
                          : isCurrent
                          ? 'bg-boon-blue ring-4 ring-boon-blue/20'
                          : 'bg-boon-offWhite'
                      }`}>
                        {step.completed ? (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : isCurrent ? (
                          <div className="w-2 h-2 bg-white rounded-pill" />
                        ) : (
                          <div className="w-2 h-2 bg-boon-charcoal/55 rounded-pill" />
                        )}
                      </div>
                      {!isLast && (
                        <div className={`w-0.5 h-12 ${step.completed ? 'bg-boon-success/50' : 'bg-boon-offWhite'}`} />
                      )}
                    </div>
                    <div className="pb-8">
                      <p className={`font-bold ${isCurrent ? 'text-boon-blue' : step.completed ? 'text-boon-navy' : 'text-boon-charcoal/55'}`}>
                        {step.label}
                        {isCurrent && <span className="ml-2 text-xs font-normal">(You're here)</span>}
                      </p>
                      <p className={`text-sm ${step.completed || isCurrent ? 'text-boon-charcoal/55' : 'text-boon-charcoal/55'}`}>
                        {step.detail}
                      </p>
                    </div>
                  </div>
                );
              };

              if (shouldCollapse) {
                // Collapsed view: milestones, collapsed row, last 3 sessions, remaining
                const collapsedCount = sessionSteps.length - 3;
                const firstDate = sessionSteps[0]?.detail?.match(/\w+ \d+/)?.[0] || '';
                const lastCollapsedDate = sessionSteps[collapsedCount - 1]?.detail?.match(/\w+ \d+/)?.[0] || '';
                const recentSessions = sessionSteps.slice(-3);

                return (
                  <>
                    {milestoneSteps.map(step => renderStep(step, false))}
                    {/* Collapsed sessions row */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-pill bg-boon-success flex items-center justify-center">
                          <span className="text-xs font-bold text-white">{collapsedCount}</span>
                        </div>
                        <div className="w-0.5 h-12 bg-boon-success/50" />
                      </div>
                      <div className="pb-8">
                        <button
                          onClick={() => setTimelineExpanded(true)}
                          className="font-bold text-boon-navy hover:text-boon-blue transition-colors text-left"
                        >
                          Sessions 1-{collapsedCount}
                          <span className="text-sm font-normal text-boon-charcoal/55 ml-2">({firstDate} - {lastCollapsedDate})</span>
                        </button>
                        <p className="text-sm text-boon-blue cursor-pointer hover:underline" onClick={() => setTimelineExpanded(true)}>
                          Show all sessions
                        </p>
                      </div>
                    </div>
                    {recentSessions.map((step, idx) => renderStep(step, idx === recentSessions.length - 1 && remainingSteps.length === 0))}
                    {remainingSteps.map((step, idx) => renderStep(step, idx === remainingSteps.length - 1))}
                  </>
                );
              }

              // Expanded or small timeline: render all steps
              const allSteps = [...milestoneSteps, ...sessionSteps, ...remainingSteps];
              return (
                <>
                  {allSteps.map((step, idx) => renderStep(step, idx === allSteps.length - 1))}
                  {timelineExpanded && sessionSteps.length > 5 && (
                    <button
                      onClick={() => setTimelineExpanded(false)}
                      className="text-sm font-bold text-boon-blue hover:underline ml-12 mt-2"
                    >
                      Show less
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </section>

        {/* Your Wins */}
        <section className="bg-white rounded-card p-8 border border-boon-charcoal/[0.08]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-extrabold text-boon-navy">Your Wins</h2>
            <button
              onClick={() => setShowAddWinModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-boon-blue hover:bg-boon-lightBlue/30 rounded-btn transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add a win
            </button>
          </div>

          {coachingWins.length > 0 ? (
            <div className="space-y-4">
              {coachingWins.map((win) => (
                <div key={win.id} className="p-5 bg-boon-coral/12 rounded-card border border-boon-charcoal/[0.08] group relative">
                  {editingWinId === win.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={editWinText}
                        onChange={(e) => setEditWinText(e.target.value)}
                        className="w-full p-3 border border-boon-charcoal/[0.08] rounded-btn text-sm resize-none focus:outline-none focus:ring-2 focus:ring-boon-coral"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="px-3 py-1.5 bg-boon-coral text-white text-xs font-bold rounded-btn hover:bg-boon-coralLight"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 bg-boon-offWhite text-boon-charcoal/75 text-xs font-bold rounded-btn hover:bg-boon-charcoal/20"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <span className="text-xl">🏆</span>
                      <div className="flex-1 pr-12">
                        <p className="text-boon-navy leading-relaxed">"{win.win_text}"</p>
                        <p className="text-xs text-boon-charcoal/55 mt-2">
                          {win.session_number && `Session ${win.session_number} · `}
                          {new Date(win.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      {/* Edit/Delete buttons */}
                      {(
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          {(
                            <button
                              onClick={() => handleStartEdit(win)}
                              className="p-1.5 text-boon-charcoal/55 hover:text-boon-charcoal/75 hover:bg-white rounded"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          )}
                          {(
                            <button
                              onClick={() => handleDeleteWin(win.id)}
                              disabled={deletingWinId === win.id}
                              className="p-1.5 text-boon-charcoal/55 hover:text-boon-error hover:bg-white rounded disabled:opacity-50"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-boon-coral/12 rounded-card p-6 border border-boon-charcoal/[0.08]">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-btn bg-boon-coral flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-boon-navy mb-1">What counts as a win?</h3>
                  <p className="text-sm text-boon-charcoal/75 leading-relaxed mb-3">
                    A difficult conversation you handled well. Feedback you gave or received. A new habit that stuck. A boundary you set. No win is too small.
                  </p>
                  <button
                    onClick={() => setShowAddWinModal(true)}
                    className="text-sm font-bold text-boon-coral hover:text-boon-lightCoral transition-colors"
                  >
                    + Add your first win
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Add Win Modal */}
        {showAddWinModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-card p-6 w-full max-w-md">
              <h3 className="text-lg font-bold text-boon-navy mb-4">Add a Win</h3>
              <p className="text-sm text-boon-charcoal/55 mb-4">
                Capture a breakthrough, accomplishment, or moment you're proud of.
              </p>
              <textarea
                value={newWinText}
                onChange={(e) => setNewWinText(e.target.value)}
                placeholder="What's a win you want to celebrate?"
                className="w-full p-4 border border-boon-charcoal/[0.08] rounded-btn focus:border-boon-blue focus:ring-0 focus:outline-none resize-none"
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-boon-charcoal/55 text-right mt-1">{newWinText.length}/500</p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowAddWinModal(false);
                    setNewWinText('');
                  }}
                  className="flex-1 px-4 py-3 text-boon-charcoal/75 font-medium rounded-btn hover:bg-boon-offWhite transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddWin}
                  disabled={!newWinText.trim() || isSubmittingWin}
                  className="flex-1 px-4 py-3 bg-boon-blue text-white font-bold rounded-btn hover:bg-boon-darkBlue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingWin ? 'Saving...' : 'Save Win'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Pending Reflection: Show baseline only, final scores locked until reflection complete
  if (isPendingReflection) {
    // Build baseline-only competency data
    const baselineCompetencyData = COMPETENCIES.map(comp => {
      const baselineKey = `comp_${comp.key}` as keyof BaselineSurvey;
      const rawValue = baseline?.[baselineKey] as number | null;
      return {
        key: comp.key,
        label: comp.label,
        shortLabel: comp.shortLabel,
        baseline: normalizeBaselineScore(rawValue) ?? 0,
      };
    });

    return (
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <header className="text-center sm:text-left">
          <h1 className="font-display font-bold text-boon-navy text-[36px] leading-[1.05] tracking-[-0.025em]">Leadership Profile</h1>
          <p className="text-boon-charcoal/55 mt-2 font-medium">Track your leadership competency growth over time.</p>
        </header>

        {/* Completion Status Banner */}
        <section className="bg-boon-blue/10 rounded-card p-8 border-2 border-boon-blue/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-btn bg-boon-blue flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-extrabold text-boon-navy">Your Leadership Profile is almost complete</h2>
          </div>
          <p className="text-boon-charcoal/75 mb-6">
            Finish your final reflection to see your growth across all 12 competencies.
          </p>
          <button
            onClick={onStartReflection}
            className="inline-flex items-center gap-2 px-6 py-3 bg-boon-blue text-white font-bold rounded-btn hover:bg-boon-darkBlue transition-all"
          >
            Complete Reflection
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </section>

        {/* Summary Stats (Partial) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-card border border-boon-charcoal/[0.08] text-center">
            <p className="text-3xl font-black text-boon-success">{completedSessions.length}</p>
            <p className="text-[11px] font-extrabold text-boon-charcoal/55 uppercase tracking-[0.18em] mt-1">Sessions</p>
            <p className="text-[10px] text-boon-success mt-1">Complete</p>
          </div>
          <div className="bg-white p-6 rounded-card border border-boon-charcoal/[0.08] text-center">
            <p className="text-3xl font-black text-boon-coral">{COMPETENCIES.length}</p>
            <p className="text-[11px] font-extrabold text-boon-charcoal/55 uppercase tracking-[0.18em] mt-1">Competencies</p>
          </div>
          <div className="bg-white p-6 rounded-card border border-boon-charcoal/[0.08] text-center">
            <p className="text-3xl font-black text-boon-success">
              <svg className="w-7 h-7 mx-auto text-boon-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </p>
            <p className="text-[11px] font-extrabold text-boon-charcoal/55 uppercase tracking-[0.18em] mt-1">Baseline</p>
            <p className="text-[10px] text-boon-success mt-1">Complete</p>
          </div>
          <div className="bg-white p-6 rounded-card border border-boon-charcoal/[0.08] text-center">
            <p className="text-3xl font-black text-boon-warning">
              <svg className="w-7 h-7 mx-auto text-boon-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </p>
            <p className="text-[11px] font-extrabold text-boon-charcoal/55 uppercase tracking-[0.18em] mt-1">Final Assessment</p>
            <p className="text-[10px] text-boon-warning mt-1">Pending</p>
          </div>
        </div>

        {/* Competency Grid - Baseline Only */}
        <section>
          <h2 className="text-lg font-extrabold text-boon-navy mb-4">Core Leadership Competencies</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {baselineCompetencyData.map(comp => (
              <div
                key={comp.key}
                className="bg-white p-5 rounded-card border border-boon-charcoal/[0.08]"
              >
                <h3 className="font-bold text-boon-navy text-sm leading-tight mb-4">{comp.label}</h3>

                <div className="space-y-3">
                  {/* Baseline */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-boon-charcoal/55 uppercase tracking-wide">Baseline</span>
                      <span className="font-bold text-boon-charcoal/55">{comp.baseline || '·'}/5</span>
                    </div>
                    <div className="h-2 bg-boon-offWhite rounded-pill overflow-hidden">
                      <div
                        className="h-full bg-boon-charcoal/20 rounded-pill transition-all duration-500"
                        style={{ width: `${(comp.baseline || 0) * 20}%` }}
                      />
                    </div>
                  </div>

                  {/* Final - Locked */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-boon-charcoal/55 uppercase tracking-wide">Final</span>
                      <span className="font-medium text-boon-warning italic text-[11px]">Complete reflection to reveal</span>
                    </div>
                    <div className="h-2 bg-boon-offWhite rounded-pill overflow-hidden">
                      <div className="h-full bg-boon-offWhite rounded-pill border-2 border-dashed border-boon-charcoal/[0.08]" style={{ width: '100%' }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Radar Chart - Baseline Only */}
        {baseline && (
          <section className="bg-white p-8 rounded-card border border-boon-charcoal/[0.08] relative">
            <h2 className="text-lg font-extrabold text-boon-navy mb-6 text-center">
              Competency Profile
            </h2>
            <div className="h-96 opacity-50">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={baselineCompetencyData.map(comp => ({
                  competency: comp.shortLabel,
                  baseline: comp.baseline,
                  fullMark: 5,
                }))} margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis
                    dataKey="competency"
                    tick={{ fill: '#374151', fontSize: 9, fontWeight: 600 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 5]}
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                  />
                  <Radar
                    name="Baseline"
                    dataKey="baseline"
                    stroke="#9ca3af"
                    fill="#9ca3af"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-card">
              <div className="text-center p-8">
                <p className="text-boon-charcoal/75 font-medium mb-4">
                  Complete your reflection to see your full profile
                </p>
                <button
                  onClick={onStartReflection}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-boon-blue text-white font-bold rounded-btn hover:bg-boon-darkBlue transition-all"
                >
                  Complete Reflection
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    );
  }

  // Build competency data with baseline and current scores
  const competencyData = COMPETENCIES.map(comp => {
    // Get baseline from welcome_survey_baseline (comp_ prefixed columns)
    const baselineKey = `comp_${comp.key}` as keyof BaselineSurvey;
    const rawBaseline = baseline?.[baselineKey] as number | null;
    const baselineValue = normalizeBaselineScore(rawBaseline);

    // Get current from competency_scores (match by competency_name)
    const currentScore = competencyScores.find(cs =>
      mapCompetencyName(cs.competency_name) === comp.key ||
      cs.competency_name.toLowerCase().includes(comp.shortLabel.toLowerCase())
    );

    return {
      key: comp.key,
      label: comp.label,
      shortLabel: comp.shortLabel,
      baseline: baselineValue ?? 0,
      current: currentScore?.score ?? baselineValue ?? 0,
      scoreLabel: currentScore?.score_label || null,
      improvement: baselineValue && currentScore?.score
        ? Math.round(((currentScore.score - baselineValue) / baselineValue) * 100)
        : null,
    };
  });

  // Calculate average improvement for competencies
  const competenciesWithImprovement = competencyData.filter(c => c.improvement !== null);
  const avgCompetencyImprovement = competenciesWithImprovement.length > 0
    ? Math.round(competenciesWithImprovement.reduce((sum, c) => sum + (c.improvement || 0), 0) / competenciesWithImprovement.length)
    : null;

  // Check if there are actual "current" competency scores (from midpoint/end assessment)
  // If not, we should only show baseline data and not misleading "Current" scores
  const hasActualCurrentScores = competencyScores.length > 0;

  // Wellbeing metrics (keys match actual baseline column names)
  const wellbeingMetrics = [
    { key: 'satisfaction', label: 'Work Satisfaction', color: '#466FF6' },
    { key: 'productivity', label: 'Productivity', color: '#1A253B' },
    { key: 'work_life_balance', label: 'Work-Life Balance', color: '#FF6D6A' },
    { key: 'motivation', label: 'Motivation', color: '#365ABD' },
  ];

  // Get the latest survey response for current wellbeing values
  const latestProgress = progress.length > 0 ? progress[progress.length - 1] : null;

  const wellbeingData = wellbeingMetrics.map(metric => {
    // Baseline uses direct column names (satisfaction, productivity, work_life_balance, motivation)
    const baselineKey = metric.key as keyof BaselineSurvey;
    const baselineValue = baseline?.[baselineKey] as number | null;

    // Map wellbeing metric keys to survey response fields
    const progressKeyMap: Record<string, keyof SurveyResponse> = {
      'satisfaction': 'wellbeing_satisfaction',
      'productivity': 'wellbeing_productivity',
      'work_life_balance': 'wellbeing_balance',
      'motivation': 'wellbeing_resilience',
    };

    const progressKey = progressKeyMap[metric.key];
    const currentValue = latestProgress?.[progressKey] as number | null;

    // GROW/EXEC uses 1-10 scale, SCALE uses 1-5 scale
    const maxScore = isGrowOrExec ? 10 : 5;

    return {
      ...metric,
      baseline: baselineValue ?? 0,
      current: currentValue ?? baselineValue ?? 0,
      maxScore,
    };
  });

  // Check if there's any actual wellbeing data to show
  const hasWellbeingData = wellbeingData.some(metric => metric.current > 0 || metric.baseline > 0);

  // Radar chart data for competencies
  const radarData = competencyData.map(comp => ({
    competency: comp.shortLabel,
    baseline: comp.baseline,
    current: comp.current,
    fullMark: 5,
  }));

  // Bar chart data (sorted by current score)
  const barChartData = [...competencyData]
    .sort((a, b) => b.current - a.current)
    .map(comp => ({
      name: comp.shortLabel,
      score: comp.current,
      baseline: comp.baseline,
    }));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Editorial hero */}
      <header className="pb-6 border-b border-boon-charcoal/10">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="w-6 h-px bg-boon-blue" aria-hidden />
          <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-blue">
            {isCompleted ? 'A leadership profile' : 'Competency view'}
          </span>
          {isCompleted && (
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-success">
              · Program graduate
            </span>
          )}
        </div>
        <Headline as="h1" size="lg">
          {isCompleted ? 'What you built.' : 'Where you\u2019re growing.'}
          <Headline.Kicker block color="blue">
            {isCompleted ? 'Your leadership signal.' : 'Across 12 competencies.'}
          </Headline.Kicker>
        </Headline>
      </header>

      {/* Tab navigation — minimal underline tabs */}
      <div className="flex items-center gap-1">
        {isGrowOrExec && (() => {
          const isActive = activeTab === 'competencies';
          return (
            <button
              onClick={() => setActiveTab('competencies')}
              className={`relative px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                isActive ? 'text-boon-navy' : 'text-boon-charcoal/55 hover:text-boon-navy'
              }`}
            >
              {isCompleted ? 'Competency profile' : 'Competencies'}
              {isActive && (
                <span aria-hidden className="absolute left-3 right-3 -bottom-px h-[2px] bg-boon-blue rounded-pill" />
              )}
            </button>
          );
        })()}
        {hasWellbeingData && (() => {
          const isActive = activeTab === 'wellbeing';
          return (
            <button
              onClick={() => setActiveTab('wellbeing')}
              className={`relative px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                isActive ? 'text-boon-navy' : 'text-boon-charcoal/55 hover:text-boon-navy'
              }`}
            >
              Wellbeing
              {isActive && (
                <span aria-hidden className="absolute left-3 right-3 -bottom-px h-[2px] bg-boon-blue rounded-pill" />
              )}
            </button>
          );
        })()}
      </div>

      {/* Stats — editorial stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(isCompleted ? [
          {
            label: 'Strengths',
            value: String(competencyScores.filter(c => c.score_label?.toLowerCase() === 'excelling' || c.score_label?.toLowerCase() === 'mastering').length),
            accent: 'bg-boon-success',
          },
          { label: 'Sessions', value: String(completedSessions.length), accent: 'bg-boon-blue' },
          { label: 'Competencies', value: String(competencyScores.length), accent: 'bg-boon-navy' },
          { label: 'Complete', value: '100%', accent: 'bg-boon-success' },
        ] : [
          {
            label: avgCompetencyImprovement !== null ? 'Avg growth' : 'Scores recorded',
            value: avgCompetencyImprovement !== null
              ? `${avgCompetencyImprovement > 0 ? '+' : ''}${avgCompetencyImprovement}%`
              : String(competencyScores.length > 0 ? competencyScores.length : '·'),
            accent: 'bg-boon-blue',
          },
          { label: 'Sessions', value: String(completedSessions.length), accent: 'bg-boon-navy' },
          { label: 'Actions done', value: String(completedActions.length), accent: 'bg-boon-success' },
          {
            label: competenciesWithImprovement.filter(c => (c.improvement || 0) > 0).length > 0 ? 'Improving' : 'Tracked',
            value: String(competenciesWithImprovement.filter(c => (c.improvement || 0) > 0).length || competencyScores.length || '·'),
            accent: 'bg-boon-coral',
          },
        ]).map((stat, i) => (
          <div key={i} className="relative bg-white rounded-card border border-boon-charcoal/[0.08] p-5 overflow-hidden">
            <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-[3px] ${stat.accent}`} />
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-boon-charcoal/55">
              {stat.label}
            </p>
            <p className="mt-2 font-display font-bold text-boon-navy text-[30px] leading-none tracking-[-0.02em]">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Competencies Tab */}
      {activeTab === 'competencies' && isGrowOrExec && (
        <div className="space-y-8">
          {/* Competency Cards Grid */}
          <section>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {competencyData.map(comp => {
                const score = comp.current || 0;
                const scoreLbl = comp.scoreLabel?.toLowerCase();
                const badgeVariant: 'success' | 'info' | 'warning' | 'neutral' =
                  scoreLbl === 'excelling' || scoreLbl === 'mastering' ? 'success'
                  : scoreLbl === 'growing' ? 'info'
                  : scoreLbl === 'applying' ? 'warning'
                  : 'neutral';
                const accentClass =
                  badgeVariant === 'success' ? 'bg-boon-success'
                  : badgeVariant === 'warning' ? 'bg-boon-warning'
                  : badgeVariant === 'info' ? 'bg-boon-blue'
                  : 'bg-boon-charcoal/20';
                const barFillClass =
                  score >= 4 ? 'bg-boon-success'
                  : score >= 3 ? 'bg-boon-blue'
                  : 'bg-boon-warning';
                const baselinePct = (comp.baseline || 0) * 20;
                const showPractice = (scoreLbl === 'applying' || comp.current <= 3) && comp.current > 0 && !isCompleted && onNavigate;

                return (
                  <div
                    key={comp.key}
                    className="relative bg-white rounded-card border border-boon-charcoal/[0.08] overflow-hidden"
                  >
                    <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-[3px] ${accentClass}`} />
                    <div className="p-5 pl-6">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <h3 className="font-display font-bold text-boon-navy text-[15px] leading-tight tracking-[-0.01em]">
                          {comp.label}
                        </h3>
                        {comp.scoreLabel && (
                          <Badge variant={badgeVariant}>{comp.scoreLabel}</Badge>
                        )}
                      </div>

                      {hasActualCurrentScores ? (
                        <>
                          <div className="flex items-baseline gap-2 mb-2">
                            <span className="font-display font-bold text-boon-navy text-[26px] leading-none tracking-[-0.02em]">
                              {comp.current || '·'}
                            </span>
                            <span className="text-xs text-boon-charcoal/55">/ 5</span>
                            {comp.baseline !== null && comp.baseline !== comp.current && (
                              <span className="ml-2 text-[11px] font-semibold text-boon-charcoal/55">
                                from {comp.baseline}
                              </span>
                            )}
                            {comp.improvement !== null && comp.improvement !== 0 && (
                              <span className={`ml-auto inline-flex items-center gap-0.5 text-xs font-bold ${
                                comp.improvement > 0 ? 'text-boon-success' : 'text-boon-warning'
                              }`}>
                                {comp.improvement > 0 ? '↑' : '↓'} {Math.abs(comp.improvement)}%
                              </span>
                            )}
                          </div>

                          <div className="relative h-1.5 bg-boon-offWhite rounded-pill overflow-hidden">
                            <div
                              className={`h-full ${barFillClass} rounded-pill transition-all duration-500`}
                              style={{ width: `${score * 20}%` }}
                            />
                            {comp.baseline !== null && comp.baseline > 0 && comp.baseline !== comp.current && (
                              <span
                                aria-hidden
                                className="absolute top-0 bottom-0 w-px bg-boon-charcoal/40"
                                style={{ left: `${baselinePct}%` }}
                              />
                            )}
                          </div>
                        </>
                      ) : (
                        isGrowOrExec && !isCompleted && (
                          <>
                            <div className="flex items-baseline gap-2 mb-2">
                              <span className="font-display font-bold text-boon-charcoal/40 text-[26px] leading-none tracking-[-0.02em]">
                                {comp.baseline || '·'}
                              </span>
                              <span className="text-xs text-boon-charcoal/45">/ 5 baseline</span>
                            </div>
                            <p className="text-[11px] text-boon-charcoal/50 italic">Updated after midpoint</p>
                          </>
                        )
                      )}

                      {showPractice && (
                        <button
                          onClick={() => onNavigate('practice')}
                          className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.08em] text-boon-blue hover:text-boon-darkBlue transition-colors"
                        >
                          Practice this →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ─────────────── Charts: Profile (radar) + Rankings (bars) ─────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Competency Profile — radar */}
            {(baseline || competencyScores.length > 0) && (
              <Card padding="lg">
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-6 h-px bg-boon-blue" aria-hidden />
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-blue">
                    The shape of you
                  </span>
                </div>
                <Headline as="h2" size="md">
                  Competency profile.{' '}
                  <Headline.Kicker color="blue">Where it bends.</Headline.Kicker>
                </Headline>
                <div className="mt-6 h-[420px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
                      <PolarGrid stroke="#E2E5EA" />
                      <PolarAngleAxis
                        dataKey="competency"
                        tick={{ fill: '#2E353D', fontSize: 10, fontWeight: 600 }}
                      />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 5]}
                        tick={{ fill: '#A0A8B0', fontSize: 10 }}
                      />
                      <Radar
                        name="Baseline"
                        dataKey="baseline"
                        stroke="#A0A8B0"
                        fill="#A0A8B0"
                        fillOpacity={0.22}
                        strokeWidth={1.5}
                      />
                      {hasActualCurrentScores && (
                        <Radar
                          name="Current"
                          dataKey="current"
                          stroke="#466FF6"
                          fill="#466FF6"
                          fillOpacity={0.32}
                          strokeWidth={2}
                        />
                      )}
                      {hasActualCurrentScores && (
                        <Legend
                          wrapperStyle={{ paddingTop: 16 }}
                          formatter={(value) => (
                            <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-boon-charcoal/70">
                              {value}
                            </span>
                          )}
                        />
                      )}
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* Competency Rankings — horizontal bars */}
            {competencyScores.length > 0 && (
              <Card padding="lg">
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-6 h-px bg-boon-coral" aria-hidden />
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-coral">
                    Strongest to softest
                  </span>
                </div>
                <Headline as="h2" size="md">
                  Competency rankings.{' '}
                  <Headline.Kicker color="blue">In order.</Headline.Kicker>
                </Headline>
                <div className="mt-6" style={{ height: Math.max(barChartData.length * 40, 300) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEF1F5" />
                      <XAxis type="number" domain={[0, 5]} hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: '#2E353D', fontSize: 12, fontWeight: 500 }}
                        width={120}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(70, 111, 246, 0.06)' }}
                        contentStyle={{
                          borderRadius: '10px',
                          border: '1px solid rgba(46, 53, 61, 0.1)',
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={20}>
                        {barChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getBarColor(entry.score)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
          </div>

          {/* No Data State */}
          {!baseline && competencyScores.length === 0 && (
            <section className="bg-gradient-to-br from-boon-bg to-white p-8 rounded-card border border-boon-charcoal/[0.08] text-center">
              <div className="w-16 h-16 bg-boon-coral/10 rounded-pill flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-boon-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-boon-navy mb-2">Competency Data Coming Soon</h3>
              <p className="text-boon-charcoal/55 max-w-md mx-auto">
                Your competency scores will appear here after your baseline assessment and coaching sessions.
              </p>
            </section>
          )}
        </div>
      )}

      {/* Wellbeing Tab */}
      {activeTab === 'wellbeing' && hasWellbeingData && (
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-extrabold text-boon-navy mb-4">Wellbeing Metrics</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {wellbeingData.map(metric => (
                <div
                  key={metric.key}
                  className="bg-white p-6 rounded-card border border-boon-charcoal/[0.08] hover:shadow-md hover:border-boon-blue/20 transition-all"
                >
                  <span
                    aria-hidden
                    className="block w-6 h-px mb-4"
                    style={{ backgroundColor: metric.color }}
                  />
                  <h3 className="font-bold text-boon-navy text-sm mb-3">{metric.label}</h3>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-boon-charcoal/55 uppercase tracking-wide">Score</span>
                        <span className="font-bold" style={{ color: metric.color }}>
                          {metric.current ?? 'Not yet'}/{metric.maxScore}
                        </span>
                      </div>
                      <div className="h-2 bg-boon-offWhite rounded-pill overflow-hidden">
                        <div
                          className="h-full rounded-pill transition-all duration-500"
                          style={{
                            width: `${((metric.current || 0) / metric.maxScore) * 100}%`,
                            backgroundColor: metric.color
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* No Baseline State */}
          {!baseline && (
            <section className="bg-gradient-to-br from-boon-bg to-white p-8 rounded-card border border-boon-charcoal/[0.08] text-center">
              <div className="w-16 h-16 bg-boon-lightBlue rounded-pill flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-boon-navy mb-2">Complete Your Welcome Survey</h3>
              <p className="text-boon-charcoal/55 max-w-md mx-auto">
                Take the welcome survey to establish your baseline wellbeing metrics and track your progress.
              </p>
            </section>
          )}
        </div>
      )}


      {/* ─────────────── Your Wins (GROW/EXEC, in-program) ─────────────── */}
      {isGrowOrExec && !isCompleted && (
        <Card padding="lg">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="w-6 h-px bg-boon-coral" aria-hidden />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-coral">
                Your wins
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowAddWinModal(true)}>
              + Add a win
            </Button>
          </div>
          <Headline as="h2" size="md">
            What you've built.{' '}
            <Headline.Kicker color="blue">Worth marking.</Headline.Kicker>
          </Headline>

          {coachingWins.length > 0 ? (
            <div className="mt-6 flex flex-col gap-3">
              {coachingWins.map((win) => (
                <div
                  key={win.id}
                  className="relative p-5 rounded-btn bg-white border border-boon-charcoal/[0.08] hover:border-boon-coral/40 transition-colors group"
                >
                  <span aria-hidden className="absolute left-0 top-4 bottom-4 w-[2px] bg-boon-coral/60 rounded-pill" />
                  {editingWinId === win.id ? (
                    <div className="space-y-3 pl-3">
                      <textarea
                        value={editWinText}
                        onChange={(e) => setEditWinText(e.target.value)}
                        className="w-full p-3 border border-boon-charcoal/[0.12] rounded-btn text-sm resize-none focus:outline-none focus:border-boon-coral"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button variant="coral" size="sm" onClick={handleSaveEdit}>
                          Save
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="pl-3 pr-16">
                      <p className="font-serif italic text-boon-navy text-[15px] leading-relaxed">
                        "{win.win_text}"
                      </p>
                      <p className="mt-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-boon-charcoal/55">
                        {win.session_number && `Session ${win.session_number} · `}
                        {new Date(win.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button
                          onClick={() => handleStartEdit(win)}
                          className="p-1.5 text-boon-charcoal/45 hover:text-boon-charcoal/80 transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteWin(win.id)}
                          disabled={deletingWinId === win.id}
                          className="p-1.5 text-boon-charcoal/45 hover:text-boon-coral transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 p-6 rounded-btn bg-boon-offWhite border border-boon-charcoal/[0.06]">
              <p className="font-serif italic text-boon-navy text-[15px] leading-relaxed">
                "A hard conversation that landed. Feedback you finally gave. A boundary you held. A habit that stuck."
              </p>
              <p className="mt-3 text-sm text-boon-charcoal/70 leading-relaxed">
                No win is too small. The point is noticing them.
              </p>
              <div className="mt-4">
                <Button variant="coral" size="sm" onClick={() => setShowAddWinModal(true)}>
                  Add your first win
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ─────────────── Insights ─────────────── */}
      {(() => {
        const insightCards = isCompleted ? [
          {
            eyebrow: 'Growth',
            title: competencyScores.length > 0
              ? `You grew in ${competenciesWithImprovement.filter(c => (c.improvement || 0) > 0).length} of ${COMPETENCIES.length}.`
              : 'Reflected across your profile.',
            body: competencyScores.length > 0
              ? 'Across the competencies tracked through your program.'
              : 'Your growth shows up in how you lead, even when the numbers do not capture it.',
          },
          {
            eyebrow: 'Strongest area',
            title: competencyScores.length > 0
              ? (() => {
                  const highest = competencyData.filter(c => c.current > 0).sort((a, b) => b.current - a.current)[0];
                  return highest ? `${highest.label}.` : 'Strong across the board.';
                })()
              : 'Your strengths define the work.',
            body: competencyScores.length > 0
              ? 'Where you showed the most development.'
              : 'They show up in every conversation, every decision.',
          },
          {
            eyebrow: 'Continued growth',
            title: competencyScores.length > 0
              ? (() => {
                  const lowest = competencyData.filter(c => c.current > 0).sort((a, b) => a.current - b.current)[0];
                  return lowest ? `${lowest.label}.` : 'Keep practicing.';
                })()
              : 'Practice space is open.',
            body: competencyScores.length > 0
              ? 'A natural next focus if you want to keep building.'
              : 'When real challenges arrive, that is where to rehearse.',
          },
        ] : [
          {
            eyebrow: 'Growth',
            title: competencyScores.length > 0
              ? `${competencyScores.filter(c => c.score >= 4).length} at level 4 or higher.`
              : isGrowOrExec && completedSessions.length > 0
                ? `${completedSessions.length} session${completedSessions.length > 1 ? 's' : ''} in.`
                : baseline
                  ? 'Building on your baseline.'
                  : 'Insights start with your first assessment.',
            body: competencyScores.length > 0
              ? 'Out of the competencies tracked.'
              : isGrowOrExec && completedSessions.length > 0
                ? 'Updated scores arrive after your midpoint check-in.'
                : baseline
                  ? 'Growth scores arrive after the midpoint assessment.'
                  : 'Once your baseline is in, this view fills out.',
          },
          {
            eyebrow: 'Focus area',
            title: competencyScores.length > 0
              ? (() => {
                  const lowest = competencyData.filter(c => c.current > 0).sort((a, b) => a.current - b.current)[0];
                  return lowest ? `${lowest.label}.` : 'Strong balance.';
                })()
              : isGrowOrExec && baseline
                ? (() => {
                    const lowestBaseline = competencyData.filter(c => c.baseline > 0).sort((a, b) => a.baseline - b.baseline)[0];
                    return lowestBaseline ? `${lowestBaseline.label}.` : 'Set in session.';
                  })()
                : 'Surfaces after baseline.',
            body: competencyScores.length > 0
              ? 'A natural place to spend coaching attention.'
              : isGrowOrExec && baseline
                ? 'Pulled from where your baseline came in lowest.'
                : 'Your baseline assessment will name it.',
          },
          {
            eyebrow: 'Next step',
            title: completedSessions.length === 0
              ? 'Book your first.'
              : completedSessions.length < 3
                ? 'Build cadence.'
                : 'Stretch the goals.',
            body: completedSessions.length === 0
              ? 'The work begins in the first conversation.'
              : completedSessions.length < 3
                ? 'Momentum compounds. Keep the rhythm regular.'
                : 'You have the practice in. Try setting something harder.',
          },
        ];

        return (
          <Card padding="lg">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-6 h-px bg-boon-blue" aria-hidden />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-blue">
                Reading the picture
              </span>
            </div>
            <Headline as="h2" size="md">
              Insights.{' '}
              <Headline.Kicker color="blue">From the data.</Headline.Kicker>
            </Headline>
            <div className="mt-6 grid sm:grid-cols-3 gap-4">
              {insightCards.map((card, i) => (
                <div
                  key={i}
                  className="relative p-5 rounded-btn bg-boon-offWhite border border-boon-charcoal/[0.06]"
                >
                  <span aria-hidden className="absolute left-0 top-5 bottom-5 w-[2px] bg-boon-blue/50 rounded-pill" />
                  <div className="pl-3">
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-boon-blue">
                      {card.eyebrow}
                    </span>
                    <h4 className="mt-2 font-display font-bold text-boon-navy text-[17px] leading-snug tracking-[-0.01em]">
                      {card.title}
                    </h4>
                    <p className="mt-2 text-sm text-boon-charcoal/70 leading-relaxed">
                      {card.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      {/* ─────────────── Add Win Modal ─────────────── */}
      {showAddWinModal && (
        <div className="fixed inset-0 bg-boon-charcoal/55 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[10px] p-7 w-full max-w-md shadow-xl border border-boon-charcoal/[0.08]">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-6 h-px bg-boon-coral" aria-hidden />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-coral">
                Add a win
              </span>
            </div>
            <Headline as="h3" size="sm">
              What's worth marking?{' '}
              <Headline.Kicker color="blue">Big or small.</Headline.Kicker>
            </Headline>
            <p className="mt-3 text-sm text-boon-charcoal/70 leading-relaxed">
              A breakthrough, a hard conversation handled well, a habit that stuck. Notice it here.
            </p>
            <textarea
              value={newWinText}
              onChange={(e) => setNewWinText(e.target.value)}
              placeholder="e.g., Had the feedback conversation I'd been avoiding. Held the line."
              className="mt-4 w-full p-3 border border-boon-charcoal/[0.12] rounded-btn text-sm resize-none focus:outline-none focus:border-boon-coral leading-relaxed"
              rows={4}
              maxLength={500}
              autoFocus
            />
            <div className="flex justify-end mt-2 mb-4">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-boon-charcoal/45">
                {newWinText.length}/500
              </span>
            </div>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setShowAddWinModal(false);
                  setNewWinText('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="coral"
                size="md"
                onClick={handleAddWin}
                disabled={!newWinText.trim() || isSubmittingWin}
                className="flex-1"
              >
                {isSubmittingWin ? 'Saving...' : 'Save win'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
