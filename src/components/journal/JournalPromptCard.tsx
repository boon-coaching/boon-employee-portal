import { useState } from 'react';
import { useJournalData } from '../../hooks/useJournalData';
import { ResourceSuggestion } from '../ResourceSuggestion';

interface JournalPromptCardProps {
  compact?: boolean;
}

const COMPETENCY_OPTIONS = [
  'Effective Communication',
  'Delegation & Accountability',
  'Emotional Intelligence',
  'Strategic Thinking',
  'Adaptability & Resilience',
  'Giving & Receiving Feedback',
  'Building Relationships at Work',
  'Change Management',
  'Effective Planning & Execution',
  'Persuasion & Influence',
  'Self-Confidence & Imposter Syndrome',
  'Time Management & Productivity',
];

export function JournalPromptCard({ compact = false }: JournalPromptCardProps) {
  const { weeklyPrompt, addEntry, hasEntryThisWeek } = useJournalData();
  const [body, setBody] = useState('');
  const [competencyArea, setCompetencyArea] = useState('');
  const [shareWithCoach, setShareWithCoach] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedCompetency, setSavedCompetency] = useState<string | null>(null);

  async function handleSave() {
    if (!body.trim()) return;
    setSaving(true);
    const entry = await addEntry(body.trim(), competencyArea || undefined);
    setSaving(false);

    if (entry) {
      if (shareWithCoach) {
        const { updateJournalEntry } = await import('../../lib/fetchers/journalFetcher');
        await updateJournalEntry(entry.id, { is_shared_with_coach: true });
      }
      setSavedCompetency(competencyArea || null);
      setBody('');
      setCompetencyArea('');
      setShareWithCoach(false);
      setSaved(true);
    }
  }

  // Compact mode renders "naked" content (no outer container). Callers wrap
  // it in whatever surface they want — e.g. GrowDashboard wraps it in a
  // coral-outlined Card. Full mode keeps the white card shell for standalone
  // use on /journal.
  if (saved && compact) {
    return (
      <div className="flex items-center gap-2 text-boon-navy">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1.5-5.5l5-5-1-1-4 4-2-2-1 1 3 3z" fill="currentColor" />
        </svg>
        <span className="font-semibold">Reflection saved.</span>
        <a
          href="/journal"
          className="ml-auto text-sm text-boon-blue hover:text-boon-darkBlue font-semibold transition-colors"
        >
          View all →
        </a>
      </div>
    );
  }

  if (hasEntryThisWeek && compact) {
    return (
      <div className="flex items-center gap-2 text-boon-navy">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1.5-5.5l5-5-1-1-4 4-2-2-1 1 3 3z" fill="currentColor" />
        </svg>
        <span className="font-semibold">This week&apos;s reflection is done.</span>
        <a
          href="/journal"
          className="ml-auto text-sm text-boon-blue hover:text-boon-darkBlue font-semibold transition-colors"
        >
          View all →
        </a>
      </div>
    );
  }

  if (compact) {
    return (
      <div>
        <p className="font-display font-bold text-[22px] md:text-[26px] leading-[1.15] tracking-[-0.02em] text-boon-navy mb-4">
          {weeklyPrompt}
        </p>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your reflection..."
          rows={3}
          className="w-full bg-boon-offWhite border border-boon-charcoal/[0.08] rounded-btn p-3 text-sm text-boon-navy placeholder-boon-charcoal/55 resize-none focus:outline-none focus:ring-2 focus:ring-boon-coral/20 focus:border-boon-coral"
        />
        <button
          onClick={handleSave}
          disabled={!body.trim() || saving}
          className="mt-4 inline-flex items-center justify-center bg-boon-coral text-white font-semibold text-sm rounded-pill px-5 py-2.5 hover:opacity-90 disabled:cursor-not-allowed transition-opacity"
          style={{ opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Saving...' : 'Save reflection'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-card p-6 md:p-8 border border-boon-charcoal/[0.08] shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-boon-charcoal/55">
          Weekly Reflection
        </h3>
      </div>

      <p className="font-display font-bold text-xl md:text-2xl mb-4 leading-[1.2] tracking-[-0.01em] text-boon-navy">
        {weeklyPrompt}
      </p>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your reflection..."
        rows={5}
        className="w-full bg-boon-offWhite border border-boon-charcoal/[0.08] rounded-btn p-3 text-sm text-boon-navy placeholder-boon-charcoal/55 resize-none focus:outline-none focus:ring-2 focus:ring-boon-blue/20 focus:border-boon-blue"
      />

      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-boon-charcoal/55 mb-1">
            Competency area (optional)
          </label>
          <select
            value={competencyArea}
            onChange={(e) => setCompetencyArea(e.target.value)}
            className="w-full bg-boon-offWhite border border-boon-charcoal/[0.08] rounded-btn px-3 py-2 text-sm text-boon-navy focus:outline-none focus:ring-2 focus:ring-boon-blue/20 focus:border-boon-blue"
          >
            <option value="">None</option>
            {COMPETENCY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={shareWithCoach}
            onChange={(e) => setShareWithCoach(e.target.checked)}
            className="w-4 h-4 rounded-md border-boon-charcoal/[0.08] text-boon-blue accent-boon-blue focus:ring-boon-blue/20"
          />
          <span className="text-sm text-boon-charcoal/75">Share with my coach</span>
        </label>
      </div>

      <button
        onClick={handleSave}
        disabled={!body.trim() || saving}
        className="mt-4 w-full bg-boon-blue text-white font-semibold text-sm rounded-btn py-2.5 hover:bg-boon-darkBlue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Saving...' : 'Save Reflection'}
      </button>

      {saved && (
        <div className="mt-3">
          <p className="text-sm text-boon-success font-medium text-center">
            Reflection saved
          </p>
          {savedCompetency && (
            <div className="mt-3">
              <ResourceSuggestion competencyArea={savedCompetency} label="Related resource" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
