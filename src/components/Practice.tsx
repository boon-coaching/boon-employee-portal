import { useState, useMemo } from 'react';
import { SCENARIOS, CATEGORY_INFO, type PracticeScenario, type ScenarioCategory } from '../data/scenarios';
import type { Session } from '../lib/types';
import PracticeModal from './PracticeModal';

interface PracticeProps {
  sessions: Session[];
  coachName: string;
}

export default function Practice({ sessions, coachName }: PracticeProps) {
  const [selectedCategory, setSelectedCategory] = useState<ScenarioCategory | 'all'>('all');
  const [selectedScenario, setSelectedScenario] = useState<PracticeScenario | null>(null);
  const [customSituation, setCustomSituation] = useState('');

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

  const filteredScenarios = useMemo(() => {
    let scenarios = SCENARIOS;

    // Filter by category if selected
    if (selectedCategory !== 'all') {
      scenarios = scenarios.filter(s => s.category === selectedCategory);
    }

    // If user has themes, prioritize those (but still show all)
    if (hasAnyTheme) {
      scenarios = scenarios.sort((a, b) => {
        const aMatch = (a.category === 'leadership' && userThemes.leadership) ||
                       (a.category === 'communication' && userThemes.communication) ||
                       (a.category === 'wellbeing' && userThemes.wellbeing);
        const bMatch = (b.category === 'leadership' && userThemes.leadership) ||
                       (b.category === 'communication' && userThemes.communication) ||
                       (b.category === 'wellbeing' && userThemes.wellbeing);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return 0;
      });
    }

    return scenarios;
  }, [selectedCategory, userThemes, hasAnyTheme]);

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

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'High': return 'bg-red-100 text-red-600';
      case 'Medium': return 'bg-amber-100 text-amber-600';
      case 'Low': return 'bg-green-100 text-green-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <header className="text-center pt-4">
        <h1 className="text-3xl md:text-4xl font-extrabold text-boon-text mb-3">
          Practice Space
        </h1>
        <p className="text-gray-500 text-lg max-w-2xl mx-auto">
          Prepare for challenging moments with AI-powered scenarios. Get a gameplan, then practice the conversation.
        </p>
      </header>

      {/* Custom Situation Input */}
      <section className="bg-gradient-to-br from-boon-blue/5 via-white to-boon-lightBlue/20 rounded-[2rem] p-6 md:p-8 border border-boon-blue/10">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-lg font-extrabold text-boon-text mb-4 text-center">
            What's on your mind?
          </h2>
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
              placeholder="Describe your situation... (e.g., 'I need to give feedback to a senior team member who keeps missing deadlines')"
              className="w-full p-5 pr-24 rounded-2xl border-2 border-white focus:border-boon-blue focus:ring-0 focus:outline-none text-sm min-h-[100px] resize-none bg-white shadow-sm placeholder-gray-400 transition-all"
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customSituation.trim()}
              className="absolute bottom-4 right-4 px-5 py-2.5 bg-boon-blue text-white rounded-xl font-bold text-sm hover:bg-boon-darkBlue disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-boon-blue/20"
            >
              Get Help
            </button>
          </div>
        </div>
      </section>

      {/* Category Filter */}
      <div className="flex justify-center">
        <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-boon-blue text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            All Scenarios
          </button>
          {(['leadership', 'communication', 'wellbeing'] as ScenarioCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                selectedCategory === cat
                  ? 'bg-boon-blue text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {CATEGORY_INFO[cat].label}
              {hasAnyTheme && (
                (cat === 'leadership' && userThemes.leadership) ||
                (cat === 'communication' && userThemes.communication) ||
                (cat === 'wellbeing' && userThemes.wellbeing)
              ) && (
                <span className={`w-2 h-2 rounded-full ${selectedCategory === cat ? 'bg-white' : 'bg-boon-blue'}`} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Recommended for you badge */}
      {hasAnyTheme && selectedCategory === 'all' && (
        <p className="text-center text-xs text-gray-400 font-medium">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-boon-blue" />
            Scenarios matching your coaching themes are shown first
          </span>
        </p>
      )}

      {/* Scenario Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredScenarios.map(scenario => (
          <div
            key={scenario.id}
            onClick={() => setSelectedScenario(scenario)}
            className="group bg-white rounded-[1.5rem] p-6 cursor-pointer border-2 border-transparent hover:border-boon-blue/20 hover:shadow-xl transition-all duration-300 relative overflow-hidden"
          >
            {/* Background accent */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-boon-lightBlue/30 to-transparent rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500" />

            <div className="relative z-10">
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getDifficultyColor(scenario.difficulty)}`}>
                  {scenario.difficulty}
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${CATEGORY_INFO[scenario.category].bgColor} ${CATEGORY_INFO[scenario.category].color}`}>
                  {CATEGORY_INFO[scenario.category].label}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-lg font-extrabold text-boon-text mb-2 leading-tight group-hover:text-boon-blue transition-colors">
                {scenario.title}
              </h3>

              {/* Description */}
              <p className="text-gray-500 text-sm leading-relaxed mb-4 line-clamp-2">
                {scenario.description}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {scenario.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="text-[10px] font-bold text-boon-blue bg-boon-lightBlue/50 px-2 py-0.5 rounded-md">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Arrow indicator */}
            <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-boon-blue group-hover:text-white transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        ))}
      </div>

      {filteredScenarios.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 font-medium">No scenarios found for this category.</p>
        </div>
      )}

      {/* Practice Modal */}
      {selectedScenario && (
        <PracticeModal
          scenario={selectedScenario}
          initialContext={selectedScenario.id.startsWith('custom-') ? customSituation : ''}
          coachName={coachName}
          onClose={() => {
            setSelectedScenario(null);
            setCustomSituation('');
          }}
        />
      )}
    </div>
  );
}
