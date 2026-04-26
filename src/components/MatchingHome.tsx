import { useNavigate } from 'react-router-dom';
import type { Employee, BaselineSurvey, WelcomeSurveyScale, ProgramType } from '../lib/types';
import { SCALE_FOCUS_AREA_LABELS } from '../lib/types';

interface MatchingHomeProps {
  profile: Employee | null;
  baseline: BaselineSurvey | null;
  welcomeSurveyScale: WelcomeSurveyScale | null;
  programType: ProgramType | null;
}

/**
 * MatchingHome - Full dashboard experience for employees waiting for coach match
 * Shows matching status banner + goals/program info instead of a blank waiting page
 */
export default function MatchingHome({
  profile,
  baseline,
  welcomeSurveyScale,
  programType,
}: MatchingHomeProps) {
  const navigate = useNavigate();
  // Determine if we have survey data to show
  const isScaleUser = programType === 'SCALE';
  const hasWelcomeSurvey = isScaleUser ? welcomeSurveyScale !== null : baseline !== null;

  // Get coaching goals from the appropriate survey
  const rawCoachingGoals = isScaleUser
    ? (welcomeSurveyScale?.coaching_goals || welcomeSurveyScale?.additional_topics)
    : baseline?.coaching_goals;

  // Check if coaching goals are valid/helpful (not empty, "no", "n/a", "none", etc.)
  const isValidCoachingGoals = (goals: string | null | undefined): boolean => {
    if (!goals) return false;
    const trimmed = goals.trim().toLowerCase();
    if (trimmed.length < 5) return false;
    const unhelpfulResponses = ['no', 'n/a', 'na', 'none', 'nothing', 'no.', 'n/a.', 'none.', '-', '--', '...', 'idk', 'not sure', 'unsure', 'no idea'];
    return !unhelpfulResponses.includes(trimmed);
  };

  const coachingGoals = isValidCoachingGoals(rawCoachingGoals) ? rawCoachingGoals : null;

  // Get focus areas from SCALE survey (selected boolean fields)
  const scaleFocusAreas = welcomeSurveyScale ? Object.entries(SCALE_FOCUS_AREA_LABELS)
    .filter(([key]) => welcomeSurveyScale[key as keyof WelcomeSurveyScale] === true)
    .map(([, label]) => label)
  : [];

  // GROW focus area labels (maps focus_* fields to display labels)
  const growFocusAreaLabels: Record<string, string> = {
    focus_effective_communication: 'Effective Communication',
    focus_persuasion_and_influence: 'Persuasion & Influence',
    focus_adaptability_and_resilience: 'Adaptability & Resilience',
    focus_strategic_thinking: 'Strategic Thinking',
    focus_emotional_intelligence: 'Emotional Intelligence',
    focus_building_relationships_at_work: 'Building Relationships',
    focus_self_confidence_and_imposter_syndrome: 'Self-Confidence',
    focus_delegation_and_accountability: 'Delegation & Accountability',
    focus_giving_and_receiving_feedback: 'Giving & Receiving Feedback',
    focus_effective_planning_and_execution: 'Planning & Execution',
    focus_change_management: 'Change Management',
    focus_time_management_and_productivity: 'Time Management',
  };

  // Get selected focus areas from GROW baseline
  const growFocusAreas = baseline ? Object.entries(growFocusAreaLabels)
    .filter(([key]) => {
      const value = baseline[key as keyof typeof baseline];
      return value === true || value === 'true';
    })
    .map(([, label]) => label)
  : [];

  // Use appropriate focus areas based on program type
  const focusAreas = isScaleUser ? scaleFocusAreas : growFocusAreas;

  // Program display info
  const programDisplayName = programType === 'SCALE' ? 'SCALE' : programType === 'GROW' ? 'GROW' : programType === 'EXEC' ? 'Executive Coaching' : 'Coaching Program';
  const companyName = profile?.company_name || null;

  return (
    <div className="max-w-3xl mx-auto space-y-8 md:space-y-12 animate-fade-in pb-32 md:pb-0">
      <header className="text-center pt-2">
        <h1 className="font-display font-bold text-boon-navy text-[36px] md:text-[52px] leading-[1.05] tracking-[-0.025em]">
          Hi {profile?.first_name || 'there'}
        </h1>
        <p className="text-boon-charcoal/55 mt-2 text-lg font-medium">
          Welcome to Boon
        </p>
      </header>

      <section className="bg-boon-coral/12 rounded-card p-8 md:p-10 border border-boon-charcoal/[0.08]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-btn bg-boon-coral flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-coral">Coach matching</span>
        </div>

        <h2 className="font-display font-bold text-boon-navy tracking-[-0.02em] leading-[1.15] text-3xl md:text-4xl mb-6">
          Your coach is on the <span className="font-serif italic font-normal">way</span>.
        </h2>

        <p className="text-boon-charcoal/75 text-lg leading-relaxed">
          We're hand-picking someone who fits the work you want to do, not pattern-matching on a checkbox. Most matches land within a couple of days. You'll get an email and a Slack or Teams ping the moment they're chosen.
        </p>
      </section>

      {hasWelcomeSurvey && (coachingGoals || focusAreas.length > 0) && (
        <section className="bg-white rounded-card p-8 md:p-10 border border-boon-charcoal/[0.08] shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-blue">What you shared</span>
          </div>

          {coachingGoals && (
            <p className="text-boon-navy/85 text-base md:text-lg leading-relaxed font-serif italic mb-6">
              "{coachingGoals}"
            </p>
          )}

          {focusAreas.length > 0 && (
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-charcoal/55 mb-3">Focus areas</p>
              <div className="flex flex-wrap gap-2">
                {focusAreas.map((area) => (
                  <span
                    key={area}
                    className="px-3 py-1.5 text-sm font-medium bg-boon-offWhite text-boon-navy rounded-pill border border-boon-charcoal/[0.08]"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-boon-charcoal/55 text-sm mt-6">
            Your coach reads this before your first conversation.
          </p>
        </section>
      )}

      {(companyName || programType) && (
        <section className="bg-boon-offWhite rounded-card p-6 md:p-7 border border-boon-charcoal/[0.08]">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-charcoal/55 mb-2">Your program</p>
          <p className="text-boon-navy font-bold text-lg">
            {companyName ? `${companyName} · ` : ''}{programDisplayName}
          </p>
          {programType && (
            <p className="text-boon-charcoal/55 text-sm mt-1">
              {programType === 'SCALE' && 'Ongoing, on-demand sessions whenever you need them.'}
              {programType === 'GROW' && '12 structured sessions over the program.'}
              {programType === 'EXEC' && 'Executive coaching engagement, paced to your calendar.'}
            </p>
          )}
        </section>
      )}

      <button
        onClick={() => navigate('/practice')}
        className="w-full bg-white p-7 md:p-8 rounded-card border border-boon-charcoal/[0.08] shadow-sm text-left hover:border-boon-blue/30 hover:shadow-md transition-all group"
      >
        <p className="text-[11px] font-extrabold text-boon-blue uppercase tracking-[0.18em] mb-2">Practice space</p>
        <p className="text-boon-navy text-lg font-bold mb-1">Run a scenario while you wait.</p>
        <p className="text-boon-charcoal/65 text-sm">AI-powered leadership moments. Real practice, real feedback.</p>
        <span className="inline-flex items-center gap-1 mt-4 text-boon-blue text-sm font-bold group-hover:underline">
          Start practicing
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </button>

      <div className="text-center">
        <p className="text-sm text-boon-charcoal/55">
          Questions?{' '}
          <a href="mailto:hello@boon-health.com" className="text-boon-blue hover:underline">
            hello@boon-health.com
          </a>
        </p>
      </div>
    </div>
  );
}
