import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalData } from './ProtectedLayout';
import { SCENARIOS, CATEGORY_INFO } from '../data/scenarios';
import type { ScenarioCategory, PracticeScenario } from '../data/scenarios';
import { Card, Badge, Button } from '../lib/design-system';

const CATEGORY_BADGE: Record<ScenarioCategory, 'info' | 'warning' | 'success'> = {
  leadership: 'info',
  communication: 'warning',
  wellbeing: 'success',
};

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
    <Card padding="md">
      <div className="flex items-center gap-2.5 mb-5">
        <span className="w-7 h-7 rounded-pill bg-boon-blue/10 flex items-center justify-center text-boon-blue">
          <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </span>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-blue">
          Recommended practice
        </span>
      </div>
      <p className="text-boon-charcoal/55 text-sm mb-3">Before your next session, try this.</p>
      <h3 className="font-display font-bold text-boon-navy text-[22px] leading-[1.15] tracking-[-0.02em] mb-3">
        {scenario.title}
      </h3>
      <div className="mb-4">
        <Badge variant={CATEGORY_BADGE[scenario.category]}>
          {cat.label}
        </Badge>
      </div>
      <p className="text-boon-charcoal/75 text-sm leading-relaxed mb-6">{scenario.description}</p>
      <Button variant="primary" size="md" onClick={() => navigate('/practice')}>
        Start practice →
      </Button>
    </Card>
  );
}
