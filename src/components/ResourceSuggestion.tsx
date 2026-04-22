import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResources } from '../hooks/useResources';
import { usePortalData } from './ProtectedLayout';

interface ResourceSuggestionProps {
  competencyArea?: string | null;
  sessionThemes?: { leadership?: boolean; communication?: boolean; wellbeing?: boolean };
  label?: string;
}

const THEME_TO_COMPETENCY: Record<string, string[]> = {
  leadership: ['Delegation & Accountability', 'Strategic Thinking', 'Change Management', 'Effective Planning & Execution'],
  communication: ['Effective Communication', 'Persuasion & Influence', 'Giving & Receiving Feedback'],
  wellbeing: ['Adaptability & Resilience', 'Emotional Intelligence', 'Self-Confidence & Imposter Syndrome'],
};

export function ResourceSuggestion({ competencyArea, sessionThemes, label }: ResourceSuggestionProps) {
  const navigate = useNavigate();
  const { employee, competencyScores } = usePortalData();
  const { resources } = useResources(employee?.company_email, competencyScores);

  const suggestion = useMemo(() => {
    if (resources.length === 0) return null;

    // Build list of relevant competencies to match against
    const relevantCompetencies: string[] = [];

    if (competencyArea) {
      relevantCompetencies.push(competencyArea);
    }

    if (sessionThemes) {
      for (const [theme, active] of Object.entries(sessionThemes)) {
        if (active && THEME_TO_COMPETENCY[theme]) {
          relevantCompetencies.push(...THEME_TO_COMPETENCY[theme]);
        }
      }
    }

    if (relevantCompetencies.length === 0) return null;

    // Find a resource whose competencies overlap
    const match = resources.find(r =>
      r.competencies?.some(c => relevantCompetencies.includes(c))
    );

    return match || null;
  }, [resources, competencyArea, sessionThemes]);

  if (!suggestion) return null;

  const hasContent = !!suggestion.body_html;
  const hasUrl = !!(suggestion.url || suggestion.file_url);

  function handleClick() {
    if (hasContent) {
      navigate(`/resources/${suggestion!.id}`);
    } else if (hasUrl) {
      window.open(suggestion!.url || suggestion!.file_url!, '_blank');
    }
  }

  if (!hasContent && !hasUrl) return null;

  return (
    <div
      onClick={handleClick}
      className="group flex items-start gap-3 p-4 bg-boon-lightBlue/20 border border-boon-blue/10 rounded-btn cursor-pointer hover:border-boon-blue/30 transition-all"
    >
      <div className="w-8 h-8 rounded-btn bg-boon-blue/10 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        {label && (
          <p className="text-[10px] font-bold text-boon-blue uppercase tracking-[0.18em] mb-1">{label}</p>
        )}
        <p className="text-sm font-bold text-boon-navy group-hover:text-boon-blue transition-colors line-clamp-1">
          {suggestion.title}
        </p>
        {suggestion.description && (
          <p className="text-xs text-boon-charcoal/55 mt-0.5 line-clamp-1">{suggestion.description}</p>
        )}
      </div>
      <svg className="w-4 h-4 text-boon-charcoal/55 group-hover:text-boon-blue transition-colors flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}
