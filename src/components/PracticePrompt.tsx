import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalData } from './ProtectedLayout';
import { SCENARIOS, CATEGORY_INFO } from '../data/scenarios';
import type { ScenarioCategory, PracticeScenario } from '../data/scenarios';

export function PracticePrompt() {
  const navigate = useNavigate();
  const { sessions, competencyScores } = usePortalData();

  const scenario = useMemo(() => {
    const completed = sessions
      .filter(s => s.status === 'Completed')
      .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
      .slice(0, 3);

    if (completed.length === 0) return null;

    const themes = { leadership: false, communication: false, wellbeing: false };
    for (const s of completed) {
      if (s.leadership_management_skills) themes.leadership = true;
      if (s.communication_skills) themes.communication = true;
      if (s.mental_well_being) themes.wellbeing = true;
    }

    const lowScores = competencyScores
      .filter(c => c.score <= 3)
      .sort((a, b) => a.score - b.score);

    const competencyToCategory: Record<string, ScenarioCategory> = {
      'Delegation & Accountability': 'leadership',
      'Strategic Thinking': 'leadership',
      'Change Management': 'leadership',
      'Effective Communication': 'communication',
      'Persuasion & Influence': 'communication',
      'Giving & Receiving Feedback': 'communication',
      'Adaptability & Resilience': 'wellbeing',
      'Emotional Intelligence': 'wellbeing',
      'Self-Confidence & Imposter Syndrome': 'wellbeing',
    };

    let match: PracticeScenario | null = null;

    // Try matching lowest competency first
    for (const cs of lowScores) {
      const cat = competencyToCategory[cs.competency_name];
      if (cat) {
        const candidates = SCENARIOS.filter(s => s.category === cat);
        if (candidates.length > 0) {
          // Rotate based on day of year to avoid always showing the same scenario
          const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
          match = candidates[dayOfYear % candidates.length];
          break;
        }
      }
    }

    // Fall back to active coaching themes
    if (!match) {
      const activeCategories: ScenarioCategory[] = [];
      if (themes.leadership) activeCategories.push('leadership');
      if (themes.communication) activeCategories.push('communication');
      if (themes.wellbeing) activeCategories.push('wellbeing');

      if (activeCategories.length > 0) {
        const candidates = SCENARIOS.filter(s => s.category === activeCategories[0]);
        if (candidates.length > 0) {
          const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
          match = candidates[dayOfYear % candidates.length];
        }
      }
    }

    return match;
  }, [sessions, competencyScores]);

  if (!scenario) return null;

  const cat = CATEGORY_INFO[scenario.category];

  return (
    <section className="bg-gradient-to-br from-purple-50 to-boon-bg rounded-[2rem] p-8 border border-purple-100/50">
      <p className="text-xs font-bold uppercase tracking-widest text-purple-500 mb-4 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Recommended Practice
      </p>
      <p className="text-gray-500 text-sm mb-4">Before your next session, try this:</p>
      <h3 className="text-lg font-bold text-boon-text mb-2">{scenario.title}</h3>
      <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${cat.bgColor} ${cat.color} mb-3`}>
        {cat.label}
      </span>
      <p className="text-gray-600 text-sm mb-6">{scenario.description}</p>
      <button
        onClick={() => navigate('/practice')}
        className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-600/20"
      >
        Start Practice
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </section>
  );
}
