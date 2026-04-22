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
    <div className="max-w-3xl mx-auto space-y-8 md:space-y-10 animate-fade-in">
      {/* Header */}
      <header className="text-center pt-2">
        <h1 className="font-display font-bold text-boon-navy text-[36px] md:text-[52px] leading-[1.05] tracking-[-0.025em]">
          Hi {profile?.first_name || 'there'}
        </h1>
        <p className="text-boon-charcoal/55 mt-2 text-lg font-medium">
          Your coaching journey is starting
        </p>
      </header>

      {/* Matching Status Banner */}
      <section className="bg-gradient-to-br from-boon-blue/5 via-white to-boon-lightBlue/30 rounded-card p-8 md:p-10 border-2 border-boon-blue/20 shadow-lg">
        {/* Icon and Status Badge */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-boon-lightBlue to-boon-blue/20 rounded-pill flex items-center justify-center mb-4 relative">
            <svg className="w-10 h-10 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {/* Pulse ring */}
            <div className="absolute inset-0 rounded-pill border-2 border-boon-blue/30 animate-ping" />
          </div>

          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 text-sm text-boon-blue bg-boon-lightBlue px-4 py-2 rounded-pill mb-4">
            <div className="w-2 h-2 bg-boon-blue rounded-pill animate-pulse" />
            Matching in progress
          </div>

          <h2 className="text-2xl md:text-3xl font-extrabold text-boon-navy mb-2">
            Finding the right coach for you
          </h2>
          <p className="text-boon-charcoal/55 max-w-md">
            We're carefully matching you with a coach who fits your goals, preferences, and style.
          </p>
        </div>

        {/* What's Happening Timeline */}
        <div className="bg-white/60 rounded-card p-6 mb-6">
          <p className="text-sm font-bold text-boon-navy mb-4">What's happening:</p>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-pill bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-boon-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-boon-charcoal/75">Your preferences have been recorded</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-pill bg-boon-lightBlue flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="w-2 h-2 bg-boon-blue rounded-pill animate-pulse" />
              </div>
              <span className="text-boon-charcoal/75">Reviewing coaches who match your goals</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-pill bg-boon-offWhite flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="w-2 h-2 bg-boon-charcoal/20 rounded-pill" />
              </div>
              <span className="text-boon-charcoal/55">You'll receive an email/slack when matched</span>
            </li>
          </ul>
        </div>

        {/* Timeline Note */}
        <div className="bg-gradient-to-r from-boon-blue/5 to-boon-lightBlue/30 rounded-card p-4 text-center">
          <p className="text-sm text-boon-charcoal/75">
            Most people are matched within <span className="font-bold text-boon-navy">24 hours</span>
          </p>
        </div>
      </section>

      {/* Your Goals Section - Show what they shared in welcome survey */}
      {hasWelcomeSurvey && (coachingGoals || focusAreas.length > 0) && (
        <section className="bg-boon-offWhite rounded-card p-8 border border-boon-charcoal/[0.08]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-btn bg-boon-purple/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-boon-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-extrabold text-boon-navy">
              Your Goals
            </h2>
          </div>

          {/* Show coaching goals if they exist */}
          {coachingGoals && (
            <div className="mb-6">
              <p className="text-xs font-bold text-boon-purple uppercase tracking-[0.18em] mb-2">
                What you're hoping to work on
              </p>
              <p className="text-boon-charcoal/75 bg-white/60 p-4 rounded-btn border border-boon-charcoal/[0.08]/50 italic leading-relaxed">
                "{coachingGoals}"
              </p>
            </div>
          )}

          {/* Show focus areas */}
          {focusAreas.length > 0 && (
            <div>
              <p className="text-[11px] font-extrabold text-boon-charcoal/55 uppercase tracking-[0.18em] mb-3">
                Focus areas you selected
              </p>
              <div className="flex flex-wrap gap-2">
                {focusAreas.map((area) => (
                  <span
                    key={area}
                    className="px-3 py-1.5 text-sm font-medium bg-white/70 text-boon-purple rounded-pill border border-boon-charcoal/[0.08]/50"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Confirmation message */}
          <p className="text-sm text-boon-charcoal/55 mt-5 flex items-center gap-2">
            <svg className="w-4 h-4 text-boon-success flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Your coach will use this to personalize your first conversation
          </p>
        </section>
      )}

      {/* About Your Program */}
      <section className="bg-white rounded-card p-8 border border-boon-charcoal/[0.08] shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-btn bg-boon-lightBlue flex items-center justify-center">
            <svg className="w-4 h-4 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-lg font-extrabold text-boon-navy">
            About Your Program
          </h2>
        </div>

        <div className="space-y-2">
          {companyName && (
            <p className="text-xl font-bold text-boon-navy">
              {companyName} Coaching Program
            </p>
          )}
          <p className="text-boon-charcoal/55">
            <span className="font-semibold text-boon-blue">{programDisplayName}</span>
            {programType === 'SCALE' && ' • Ongoing coaching sessions'}
            {programType === 'GROW' && ' • 12 structured sessions'}
            {programType === 'EXEC' && ' • Executive coaching sessions'}
          </p>
        </div>
      </section>

      {/* What to Expect */}
      <section className="bg-gradient-to-br from-boon-bg via-white to-green-50/30 rounded-card p-8 border border-boon-charcoal/[0.08]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-btn bg-green-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-boon-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <h2 className="text-lg font-extrabold text-boon-navy">
            What to Expect
          </h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-pill bg-boon-blue text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              1
            </div>
            <div>
              <p className="font-bold text-boon-navy">Get matched with your coach</p>
              <p className="text-sm text-boon-charcoal/55">Usually within 24 hours</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-pill bg-boon-blue text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              2
            </div>
            <div>
              <p className="font-bold text-boon-navy">Book your first session</p>
              <p className="text-sm text-boon-charcoal/55">Choose a time that works for you</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-pill bg-boon-blue text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              3
            </div>
            <div>
              <p className="font-bold text-boon-navy">Start your coaching journey</p>
              <p className="text-sm text-boon-charcoal/55">Your coach receives your goals to personalize your first conversation</p>
            </div>
          </div>
        </div>
      </section>

      {/* Explore While You Wait */}
      <section className="bg-boon-offWhite rounded-card p-8 border border-boon-charcoal/[0.08] text-center">
        <div className="w-14 h-14 rounded-card bg-boon-purple/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-boon-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h3 className="text-lg font-extrabold text-boon-navy mb-2">Explore While You Wait</h3>
        <p className="text-boon-charcoal/55 text-sm mb-6 max-w-md mx-auto">
          Check out the Practice Space—AI-powered scenarios to help you prepare for real leadership moments.
        </p>
        <button
          onClick={() => navigate('/practice')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-boon-purple text-white font-bold rounded-btn hover:bg-boon-purple transition-all shadow-sm"
        >
          Explore Practice Space
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </section>

      {/* Support */}
      <div className="text-center pb-8">
        <p className="text-sm text-boon-charcoal/55">
          Questions?{' '}
          <a href="mailto:hello@boon-health.com" className="text-boon-blue hover:underline">
            Email hello@boon-health.com
          </a>
        </p>
      </div>
    </div>
  );
}
