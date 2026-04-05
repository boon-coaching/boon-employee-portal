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

  if (saved && compact) {
    return (
      <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-[2rem] p-6 md:p-8 text-white">
        <div className="flex items-center gap-2 mb-2">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1.5-5.5l5-5-1-1-4 4-2-2-1 1 3 3z" fill="currentColor" />
          </svg>
          <span className="font-semibold">Reflection saved</span>
        </div>
        <a
          href="/journal"
          className="text-white/80 hover:text-white underline underline-offset-2 text-sm transition-colors"
        >
          View all reflections
        </a>
      </div>
    );
  }

  if (hasEntryThisWeek && compact) {
    return (
      <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-[2rem] p-6 md:p-8 text-white">
        <div className="flex items-center gap-2 mb-2">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1.5-5.5l5-5-1-1-4 4-2-2-1 1 3 3z" fill="currentColor" />
          </svg>
          <span className="font-semibold">This week's reflection is done</span>
        </div>
        <a
          href="/journal"
          className="text-white/80 hover:text-white underline underline-offset-2 text-sm transition-colors"
        >
          View all reflections
        </a>
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-[2rem] p-6 md:p-8 text-white'
          : 'bg-white rounded-[2rem] p-6 md:p-8 border border-gray-100 shadow-sm'
      }
    >
      <div className="flex items-center justify-between mb-4">
        <h3
          className={
            compact
              ? 'text-xs font-bold uppercase tracking-widest text-white/70'
              : 'text-xs font-bold uppercase tracking-widest text-gray-400'
          }
        >
          Weekly Reflection
        </h3>
        {compact && (
          <span className="text-xs font-medium bg-white/20 rounded-full px-3 py-1">
            2 min
          </span>
        )}
      </div>

      <p
        className={
          compact
            ? 'text-lg font-semibold mb-4 leading-snug'
            : 'text-lg font-semibold mb-4 leading-snug text-gray-900'
        }
      >
        {weeklyPrompt}
      </p>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your reflection..."
        rows={compact ? 3 : 5}
        className={
          compact
            ? 'w-full bg-white/10 border border-white/20 rounded-xl p-3 text-sm text-white placeholder-white/50 resize-none focus:outline-none focus:ring-2 focus:ring-white/30'
            : 'w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200'
        }
      />

      {!compact && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Competency area (optional)
            </label>
            <select
              value={competencyArea}
              onChange={(e) => setCompetencyArea(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
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
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-200"
            />
            <span className="text-sm text-gray-600">Share with my coach</span>
          </label>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={!body.trim() || saving}
        className={
          compact
            ? 'mt-4 w-full bg-white text-indigo-600 font-semibold text-sm rounded-xl py-2.5 hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            : 'mt-4 w-full bg-indigo-600 text-white font-semibold text-sm rounded-xl py-2.5 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        }
      >
        {saving ? 'Saving...' : 'Save Reflection'}
      </button>

      {saved && !compact && (
        <div className="mt-3">
          <p className="text-sm text-emerald-600 font-medium text-center">
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
