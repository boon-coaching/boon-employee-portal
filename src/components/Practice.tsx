import { useState, useMemo, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Headline, Badge } from '../lib/design-system';
import { SCENARIOS, CATEGORY_INFO, type PracticeScenario, type ScenarioCategory } from '../data/scenarios';

const CATEGORY_ACCENT: Record<ScenarioCategory, string> = {
  leadership: 'bg-boon-navy',
  communication: 'bg-boon-blue',
  wellbeing: 'bg-boon-success',
};

const DIFFICULTY_BADGE: Record<string, 'error' | 'warning' | 'success' | 'neutral'> = {
  high: 'error',
  medium: 'warning',
  low: 'success',
};
// Types now accessed via usePortalData()
import { isAlumniState } from '../lib/coachingState';
import PracticeModal from './PracticeModal';
import TeamManager from './TeamManager';
import { getTeamMembers, getSavedPlans, deleteSavedPlan, type TeamMember, type SavedPlan } from '../lib/storageService';
import { usePortalData } from './ProtectedLayout';

export default function Practice() {
  const data = usePortalData();
  const sessions = data.recentSessions;
  const coachingState = data.coachingState;
  const competencyScores = data.competencyScores || [];
  const userEmail = data.employee?.company_email || '';
  const coachName = sessions.length > 0 ? sessions[0].coach_name : 'Your Coach';
  const isCompleted = isAlumniState(coachingState.state);
  const [selectedCategory, setSelectedCategory] = useState<ScenarioCategory | 'all'>('all');
  const [selectedScenario, setSelectedScenario] = useState<PracticeScenario | null>(null);
  const [customSituation, setCustomSituation] = useState('');

  // Team & Playbook state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [showTeamManager, setShowTeamManager] = useState(false);
  const [selectedTeamMember, setSelectedTeamMember] = useState<TeamMember | null>(null);
  const [_isLoading, setIsLoading] = useState(true);

  // Load team members and saved plans
  const refreshData = useCallback(async () => {
    if (!userEmail) return;
    const [members, plans] = await Promise.all([
      getTeamMembers(userEmail),
      getSavedPlans(userEmail)
    ]);
    setTeamMembers(members);
    setSavedPlans(plans);
  }, [userEmail]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await refreshData();
      setIsLoading(false);
    };
    loadData();
  }, [refreshData]);

  const handleDeletePlan = async (id: string) => {
    if (confirm('Delete this saved plan?')) {
      await deleteSavedPlan(id);
      toast('Plan removed from playbook');
      refreshData();
    }
  };

  const handleOpenSavedPlan = (plan: SavedPlan) => {
    const originalScenario = SCENARIOS.find(s => s.id === plan.scenario_id);
    const scenarioToOpen: PracticeScenario = originalScenario ?? {
      id: plan.scenario_id || `custom-${plan.id}`,
      title: plan.scenario_title || 'Custom Situation',
      category: 'leadership',
      description: plan.context.slice(0, 100) + (plan.context.length > 100 ? '...' : ''),
      difficulty: 'Medium',
      tags: ['custom'],
      explanation: 'Your specific situation requires a tailored approach.',
      basePrompt: `**STRATEGY GUIDE:** ${plan.scenario_title || 'Custom Situation'}\n\nBased on your specific situation, we'll help you:\n1. Understand what's really happening\n2. Identify the key stakeholders and dynamics\n3. Develop a clear action plan\n4. Practice the conversation`,
    };
    setSelectedScenario(scenarioToOpen);
    setCustomSituation(plan.context);
    if (plan.team_member_id) {
      const member = teamMembers.find(m => m.id === plan.team_member_id);
      setSelectedTeamMember(member || null);
    }
  };

  // Determine user's coaching themes from their session history
  const userThemes = useMemo(() => {
    const completedSessions = sessions.filter(s => s.status === 'Completed');
    return {
      leadership: completedSessions.some(s => s.leadership_management_skills),
      communication: completedSessions.some(s => s.communication_skills),
      wellbeing: completedSessions.some(s => s.mental_well_being)
    };
  }, [sessions]);

  // If no themes detected, show all
  const hasAnyTheme = userThemes.leadership || userThemes.communication || userThemes.wellbeing;

  // Identify low-scoring competencies (score <= 3 or label is "Applying")
  const lowScoringCategories = useMemo(() => {
    const categoryMap: Record<string, ScenarioCategory> = {
      'effective_communication': 'communication',
      'giving_and_receiving_feedback': 'communication',
      'persuasion_and_influence': 'communication',
      'building_relationships_at_work': 'communication',
      'emotional_intelligence': 'wellbeing',
      'adaptability_and_resilience': 'wellbeing',
      'self_confidence_and_imposter_syndrome': 'wellbeing',
      'leadership_management_skills': 'leadership',
      'people_management': 'leadership',
      'delegation_and_accountability': 'leadership',
      'change_management': 'leadership',
      'strategic_thinking': 'leadership',
      'effective_planning_and_execution': 'leadership',
      'time_management_and_productivity': 'leadership',
    };

    const lowCategories = new Set<ScenarioCategory>();

    competencyScores.forEach(score => {
      const key = score.competency_name.toLowerCase().replace(/ /g, '_').replace(/&/g, 'and');
      if (score.score <= 3 || score.score_label?.toLowerCase() === 'applying') {
        const category = categoryMap[key];
        if (category) {
          lowCategories.add(category);
        }
      }
    });

    return lowCategories;
  }, [competencyScores]);

  const filteredScenarios = useMemo(() => {
    let scenarios = [...SCENARIOS]; // Create a copy to avoid mutating original

    // Filter by category if selected
    if (selectedCategory !== 'all') {
      scenarios = scenarios.filter(s => s.category === selectedCategory);
    }

    // Prioritize based on: 1) user themes, 2) low-scoring competencies, 3) all others
    scenarios = scenarios.sort((a, b) => {
      // First priority: matches coaching themes
      const aThemeMatch = (a.category === 'leadership' && userThemes.leadership) ||
                         (a.category === 'communication' && userThemes.communication) ||
                         (a.category === 'wellbeing' && userThemes.wellbeing);
      const bThemeMatch = (b.category === 'leadership' && userThemes.leadership) ||
                         (b.category === 'communication' && userThemes.communication) ||
                         (b.category === 'wellbeing' && userThemes.wellbeing);

      // Second priority: matches low-scoring competencies
      const aCompMatch = lowScoringCategories.has(a.category);
      const bCompMatch = lowScoringCategories.has(b.category);

      // Theme match wins over competency match
      if (aThemeMatch && !bThemeMatch) return -1;
      if (!aThemeMatch && bThemeMatch) return 1;

      // If both have same theme match, check competency match
      if (aCompMatch && !bCompMatch) return -1;
      if (!aCompMatch && bCompMatch) return 1;

      return 0;
    });

    return scenarios;
  }, [selectedCategory, userThemes, lowScoringCategories]);

  const handleCustomSubmit = () => {
    if (!customSituation.trim()) return;

    // Create a custom scenario on the fly
    const customScenario: PracticeScenario = {
      id: `custom-${Date.now()}`,
      title: 'Custom Situation',
      category: 'leadership',
      description: customSituation.slice(0, 100) + (customSituation.length > 100 ? '...' : ''),
      difficulty: 'Medium',
      tags: ['custom'],
      explanation: 'Your specific situation requires a tailored approach.',
      basePrompt: `**STRATEGY GUIDE:** Custom Situation Analysis

Based on your specific situation, we'll help you:
1. Understand what's really happening
2. Identify the key stakeholders and dynamics
3. Develop a clear action plan
4. Practice the conversation

Describe your situation in detail so we can provide the most relevant guidance.`
    };

    setSelectedScenario(customScenario);
  };

    return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Editorial hero */}
      <header className="pb-6 border-b border-boon-charcoal/10">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="w-6 h-px bg-boon-blue" aria-hidden />
          <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-blue">
            {isCompleted ? 'Leadership toolkit' : 'Before the hard conversation'}
          </span>
          {isCompleted && (
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-success">
              · Program graduate
            </span>
          )}
        </div>
        <Headline as="h1" size="lg">
          {isCompleted ? 'Leadership toolkit.' : 'Practice space.'}
          <Headline.Kicker block color="blue">
            {isCompleted ? 'For when it matters most.' : 'Rehearse before you raise it.'}
          </Headline.Kicker>
        </Headline>
      </header>

      {/* My Team & My Playbook Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* My Team Card */}
        <div className="bg-white rounded-card p-5 border border-boon-charcoal/[0.08] hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-btn bg-boon-coral/12 flex items-center justify-center">
                <svg className="w-5 h-5 text-boon-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-boon-navy">My Team</h3>
                <p className="text-xs text-boon-charcoal/55">{teamMembers.length > 0 ? `${teamMembers.length} member${teamMembers.length !== 1 ? 's' : ''}` : 'Get more relevant practice'}</p>
              </div>
            </div>
            <button
              onClick={() => setShowTeamManager(true)}
              className="px-3 py-1.5 text-xs font-bold text-boon-coral bg-boon-coral/12 hover:bg-boon-coral/20 rounded-btn transition-colors"
            >
              {teamMembers.length > 0 ? 'Manage' : 'Add'}
            </button>
          </div>
          {teamMembers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {teamMembers.slice(0, 4).map(member => (
                <span key={member.id} className="px-2.5 py-1 bg-boon-offWhite rounded-btn text-xs font-medium text-boon-charcoal/75">
                  {member.name}
                </span>
              ))}
              {teamMembers.length > 4 && (
                <span className="px-2.5 py-1 bg-boon-offWhite rounded-btn text-xs font-medium text-boon-charcoal/55">
                  +{teamMembers.length - 4} more
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-boon-charcoal/55">Add the people you work with to get tailored scenarios and conversation strategies.</p>
          )}
        </div>

        {/* My Playbook Card */}
        <div className="bg-white rounded-card p-5 border border-boon-charcoal/[0.08] hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-btn bg-boon-warning/12 flex items-center justify-center">
                <svg className="w-5 h-5 text-boon-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-boon-navy">My Playbook</h3>
                <p className="text-xs text-boon-charcoal/55">{savedPlans.length > 0 ? `${savedPlans.length} saved plan${savedPlans.length !== 1 ? 's' : ''}` : 'Your conversation playbook'}</p>
              </div>
            </div>
          </div>
          {savedPlans.length > 0 ? (
            <div className="space-y-2 max-h-24 overflow-y-auto">
              {savedPlans.slice(0, 3).map(plan => (
                <div key={plan.id} className="flex items-center justify-between group">
                  <button
                    onClick={() => handleOpenSavedPlan(plan)}
                    className="text-xs text-boon-charcoal/75 hover:text-boon-blue truncate flex-1 text-left"
                  >
                    {plan.scenario_title} {plan.team_member_name && `• ${plan.team_member_name}`}
                  </button>
                  <button
                    onClick={() => handleDeletePlan(plan.id)}
                    className="p-1 text-gray-300 hover:text-boon-error opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-boon-charcoal/55">Try a scenario above and your gameplan will be saved here for quick reference before real conversations.</p>
          )}
        </div>
      </div>

      {/* Custom Situation Input */}
      <section className="relative bg-white rounded-card border border-boon-charcoal/[0.08] p-6 md:p-8 overflow-hidden">
        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-boon-coral" />
        <div className="max-w-2xl mx-auto pl-2">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-6 h-px bg-boon-coral" aria-hidden />
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-coral">
              In the moment
            </span>
          </div>
          <h2 className="font-display font-bold text-boon-navy text-[22px] leading-tight tracking-[-0.02em] mb-4">
            {isCompleted ? 'What challenge are you facing?' : "What's on your mind?"}
          </h2>

          {/* Team Member Selector */}
          {teamMembers.length > 0 && (
            <div className="mb-4">
              <label className="text-xs font-bold text-boon-charcoal/55 uppercase tracking-wide mb-2 block">
                This is about... (optional)
              </label>
              <select
                value={selectedTeamMember?.id || ''}
                onChange={(e) => {
                  const member = teamMembers.find(m => m.id === e.target.value);
                  setSelectedTeamMember(member || null);
                }}
                className="w-full p-3 rounded-btn border-2 border-white bg-white text-sm focus:border-boon-blue focus:ring-0 focus:outline-none shadow-sm"
              >
                <option value="">General situation (no specific person)</option>
                {teamMembers.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.name} {member.role && `- ${member.role}`}
                  </option>
                ))}
              </select>
              {selectedTeamMember?.context && (
                <p className="mt-2 text-xs text-boon-charcoal/55 italic">
                  {selectedTeamMember.context}
                </p>
              )}
            </div>
          )}

          <div className="relative">
            <textarea
              value={customSituation}
              onChange={(e) => setCustomSituation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleCustomSubmit();
                }
              }}
              placeholder={selectedTeamMember
                ? `Describe your situation with ${selectedTeamMember.name}...`
                : "Describe your situation... (e.g., 'I need to give feedback to a senior team member who keeps missing deadlines')"
              }
              className="w-full p-5 pr-24 rounded-card border-2 border-white focus:border-boon-blue focus:ring-0 focus:outline-none text-sm min-h-[100px] resize-none bg-white shadow-sm placeholder-gray-400 transition-all"
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customSituation.trim()}
              className="absolute bottom-4 right-4 px-5 py-2.5 text-white bg-boon-coral rounded-pill font-semibold text-sm hover:opacity-90 disabled:cursor-not-allowed transition-opacity"
              style={{ opacity: !customSituation.trim() ? 0.5 : 1 }}
            >
              {isCompleted ? 'Get strategy' : 'Get help'}
            </button>
          </div>
        </div>
      </section>

      {/* Category Filter — underline tabs */}
      <div className="flex items-center gap-1 border-b border-boon-charcoal/10 -mb-px overflow-x-auto">
        {(() => {
          const isActive = selectedCategory === 'all';
          return (
            <button
              onClick={() => setSelectedCategory('all')}
              className={`relative px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                isActive ? 'text-boon-navy' : 'text-boon-charcoal/55 hover:text-boon-navy'
              }`}
            >
              All scenarios
              {isActive && (
                <span aria-hidden className="absolute left-3 right-3 -bottom-px h-[2px] bg-boon-blue rounded-pill" />
              )}
            </button>
          );
        })()}
        {(['leadership', 'communication', 'wellbeing'] as ScenarioCategory[]).map(cat => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`relative px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap flex items-center gap-2 ${
                isActive ? 'text-boon-navy' : 'text-boon-charcoal/55 hover:text-boon-navy'
              }`}
            >
              {CATEGORY_INFO[cat].label}
              {hasAnyTheme && (
                (cat === 'leadership' && userThemes.leadership) ||
                (cat === 'communication' && userThemes.communication) ||
                (cat === 'wellbeing' && userThemes.wellbeing)
              ) && (
                <span className="w-1.5 h-1.5 rounded-pill bg-boon-blue" />
              )}
              {isActive && (
                <span aria-hidden className="absolute left-3 right-3 -bottom-px h-[2px] bg-boon-blue rounded-pill" />
              )}
            </button>
          );
        })}
      </div>

      {/* Recommended for you badge */}
      {hasAnyTheme && selectedCategory === 'all' && (
        <p className="text-center text-xs text-boon-charcoal/55 font-medium">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-pill bg-boon-coral" />
            What you've been working on, surfaced first.
          </span>
        </p>
      )}

      {/* Scenario Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredScenarios.map(scenario => {
          const diffBadge = DIFFICULTY_BADGE[scenario.difficulty.toLowerCase()] || 'neutral';
          return (
            <button
              key={scenario.id}
              onClick={() => setSelectedScenario(scenario)}
              className="group relative bg-white rounded-card border border-boon-charcoal/[0.08] hover:border-boon-blue/30 hover:shadow-sm transition-all text-left overflow-hidden"
            >
              <span
                aria-hidden
                className={`absolute left-0 top-0 bottom-0 w-[3px] ${CATEGORY_ACCENT[scenario.category]}`}
              />
              <div className="p-5 pl-6">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-charcoal/55">
                    {CATEGORY_INFO[scenario.category].label}
                  </span>
                  <Badge variant={diffBadge}>{scenario.difficulty}</Badge>
                </div>

                <h3 className="font-display font-bold text-boon-navy text-[17px] leading-tight tracking-[-0.015em] mb-2 group-hover:text-boon-blue transition-colors">
                  {scenario.title}
                </h3>

                <p className="text-boon-charcoal/65 text-sm leading-relaxed line-clamp-2 mb-4">
                  {scenario.description}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {scenario.tags.slice(0, 3).map(tag => (
                    <span
                      key={tag}
                      className="text-[11px] font-semibold text-boon-charcoal/65 bg-boon-offWhite px-2 py-0.5 rounded-pill"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {filteredScenarios.length === 0 && (
        <div className="text-center py-16 bg-white rounded-card border border-boon-charcoal/[0.08]">
          <p className="font-display font-bold text-boon-navy text-xl mb-2 tracking-[-0.02em]">
            Nothing here <span className="font-serif italic font-normal">yet</span>.
          </p>
          <p className="text-boon-charcoal/55 text-sm">Try a different category, or run a custom scenario.</p>
        </div>
      )}

      {/* Practice Modal */}
      {selectedScenario && (
        <PracticeModal
          scenario={selectedScenario}
          initialContext={customSituation}
          coachName={coachName}
          teamMember={selectedTeamMember}
          userEmail={userEmail}
          onClose={() => {
            setSelectedScenario(null);
            setCustomSituation('');
            setSelectedTeamMember(null);
          }}
          onPlanSaved={refreshData}
        />
      )}

      {/* Team Manager Modal */}
      {showTeamManager && (
        <TeamManager
          members={teamMembers}
          userEmail={userEmail}
          onUpdate={refreshData}
          onClose={() => setShowTeamManager(false)}
        />
      )}
    </div>
  );
}
