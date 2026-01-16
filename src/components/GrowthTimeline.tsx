import type { Checkpoint, BaselineSurvey } from '../lib/types';

interface GrowthTimelineProps {
  checkpoints: Checkpoint[];
  baseline: BaselineSurvey | null;
  onCheckpointClick?: (checkpoint: Checkpoint) => void;
}

// Calculate average score from competency scores object
function getAverageScore(scores: Checkpoint['competency_scores']): number {
  const values = Object.values(scores);
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

// Calculate percentage change from baseline
function getPercentageFromBaseline(checkpoints: Checkpoint[], baseline: BaselineSurvey | null): number[] {
  if (!baseline) return checkpoints.map(() => 0);

  // Get baseline average
  const baselineScores = [
    baseline.comp_adaptability_and_resilience,
    baseline.comp_building_relationships_at_work,
    baseline.comp_change_management,
    baseline.comp_delegation_and_accountability,
    baseline.comp_effective_communication,
    baseline.comp_effective_planning_and_execution,
    baseline.comp_emotional_intelligence,
    baseline.comp_giving_and_receiving_feedback,
    baseline.comp_persuasion_and_influence,
    baseline.comp_self_confidence_and_imposter_syndrome,
    baseline.comp_strategic_thinking,
    baseline.comp_time_management_and_productivity,
  ].filter((s): s is number => s !== null);

  if (baselineScores.length === 0) return checkpoints.map(() => 0);

  const baselineAvg = baselineScores.reduce((sum, val) => sum + val, 0) / baselineScores.length;

  return checkpoints.map(cp => {
    const cpAvg = getAverageScore(cp.competency_scores);
    return Math.round(((cpAvg - baselineAvg) / baselineAvg) * 100);
  });
}

export default function GrowthTimeline({ checkpoints, baseline, onCheckpointClick }: GrowthTimelineProps) {
  if (checkpoints.length === 0) {
    return (
      <div className="bg-gray-50 rounded-2xl p-8 text-center">
        <p className="text-gray-500 text-sm">
          Complete your first check-in to start building your growth timeline.
        </p>
      </div>
    );
  }

  const percentages = getPercentageFromBaseline(checkpoints, baseline);

  return (
    <div className="space-y-4">
      {/* Timeline */}
      <div className="relative">
        {/* Line */}
        <div className="absolute top-6 left-8 right-8 h-0.5 bg-gray-200" />

        {/* Checkpoints */}
        <div className="relative flex justify-between px-4">
          {/* Baseline */}
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center z-10">
              <span className="text-xs font-bold text-gray-500">Base</span>
            </div>
            <p className="text-xs font-medium text-gray-400 mt-2">
              {baseline ? new Date(baseline.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : 'Start'}
            </p>
            <p className="text-xs text-gray-400">Baseline</p>
          </div>

          {/* Checkpoint nodes */}
          {checkpoints.map((cp, idx) => {
            const percentage = percentages[idx];
            const isPositive = percentage > 0;
            const isNeutral = percentage === 0;

            return (
              <div
                key={cp.id}
                className={`flex flex-col items-center ${onCheckpointClick ? 'cursor-pointer' : ''}`}
                onClick={() => onCheckpointClick?.(cp)}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center z-10 transition-all ${
                    onCheckpointClick ? 'hover:scale-110 hover:shadow-lg' : ''
                  } ${
                    isPositive
                      ? 'bg-green-100 text-green-700'
                      : isNeutral
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <span className="text-xs font-bold">
                    {isPositive ? '+' : ''}{percentage}%
                  </span>
                </div>
                <p className="text-xs font-medium text-gray-600 mt-2">
                  {new Date(cp.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                </p>
                <p className="text-xs text-gray-400">Check-in {cp.checkpoint_number}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
