import { useState } from 'react';
import type { Goal, WeeklyCommitment, GoalCheckin } from '../../lib/types';
import { COMPETENCY_TAG_LABELS } from '../../lib/types';
import { CommitmentInput } from './CommitmentInput';

const tagColors = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
];

function getTagColor(competencyArea: string | null): string {
  if (!competencyArea) return tagColors[0];
  const colorIndex = competencyArea.length % tagColors.length;
  return tagColors[colorIndex];
}

function getTagLabel(competencyArea: string): string {
  return COMPETENCY_TAG_LABELS[competencyArea] || competencyArea;
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function formatWeekLabel(weekStart: string): string {
  const date = new Date(weekStart + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface GoalCardProps {
  goal: Goal;
  commitments: WeeklyCommitment[];
  checkins: GoalCheckin[];
  onSetCommitment: (goalId: string, text: string) => Promise<void>;
  onCheckin: (commitmentId: string) => void;
  isReadOnly?: boolean;
}

export function GoalCard({
  goal,
  commitments,
  checkins,
  onSetCommitment,
  onCheckin,
  isReadOnly = false,
}: GoalCardProps) {
  const [showHistory, setShowHistory] = useState(false);

  const currentWeekStart = getWeekStart();
  const thisWeekCommitment = commitments.find(
    c => c.week_start === currentWeekStart,
  );

  const thisWeekCheckins = thisWeekCommitment
    ? checkins.filter(ch => ch.commitment_id === thisWeekCommitment.id)
    : [];
  const hasMidweek = thisWeekCheckins.some(ch => ch.checkin_type === 'midweek');
  const hasEndweek = thisWeekCheckins.some(ch => ch.checkin_type === 'endweek');

  const recentCommitments = commitments
    .filter(c => c.week_start !== currentWeekStart)
    .sort((a, b) => b.week_start.localeCompare(a.week_start))
    .slice(0, 4);

  return (
    <div
      className={`bg-white rounded-[2rem] p-6 md:p-8 border border-gray-100 shadow-sm transition-all ${
        isReadOnly ? 'opacity-70' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-extrabold text-boon-text leading-snug">
            {goal.title}
          </h3>
          {goal.competency_area && (
            <span
              className={`inline-block mt-2 px-3 py-0.5 rounded-full text-xs font-bold ${getTagColor(goal.competency_area)}`}
            >
              {getTagLabel(goal.competency_area)}
            </span>
          )}
        </div>
        {goal.status === 'completed' && (
          <span className="flex-shrink-0 px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-full">
            Completed
          </span>
        )}
      </div>

      {/* This week's commitment */}
      {!isReadOnly && thisWeekCommitment && (
        <div className="mb-4 p-4 rounded-2xl bg-boon-bg border border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
                This week
              </p>
              <p className="text-boon-text text-sm leading-relaxed">
                {thisWeekCommitment.commitment_text}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 pt-1">
              <button
                onClick={() => !hasMidweek && onCheckin(thisWeekCommitment.id)}
                title="Midweek check-in"
                disabled={hasMidweek}
                className="group"
              >
                <span
                  className={`block w-3.5 h-3.5 rounded-full border-2 transition-all ${
                    hasMidweek
                      ? 'bg-emerald-400 border-emerald-400'
                      : 'border-gray-300 group-hover:border-boon-blue cursor-pointer'
                  }`}
                />
              </button>
              <button
                onClick={() =>
                  hasMidweek && !hasEndweek && onCheckin(thisWeekCommitment.id)
                }
                title="End of week reflection"
                disabled={!hasMidweek || hasEndweek}
                className="group"
              >
                <span
                  className={`block w-3.5 h-3.5 rounded-full border-2 transition-all ${
                    hasEndweek
                      ? 'bg-emerald-400 border-emerald-400'
                      : 'border-gray-300 group-hover:border-boon-blue cursor-pointer'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No commitment this week - show input */}
      {!isReadOnly && !thisWeekCommitment && (
        <CommitmentInput
          goalTitle={goal.title}
          onSubmit={text => onSetCommitment(goal.id, text)}
        />
      )}

      {/* Commitment History */}
      {recentCommitments.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-xs text-gray-400 font-medium hover:text-gray-500 transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showHistory ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
            Past weeks ({recentCommitments.length})
          </button>

          {showHistory && (
            <div className="mt-2 space-y-1.5 pl-1">
              {recentCommitments.map(c => (
                <div key={c.id} className="flex items-start gap-2 text-xs text-gray-400">
                  <span className="font-medium text-gray-300 w-16 flex-shrink-0">
                    {formatWeekLabel(c.week_start)}
                  </span>
                  <span className="leading-relaxed">{c.commitment_text}</span>
                  <span
                    className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      c.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-500'
                        : c.status === 'partial'
                          ? 'bg-amber-50 text-amber-500'
                          : c.status === 'missed'
                            ? 'bg-red-50 text-red-400'
                            : 'bg-gray-50 text-gray-400'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
