import { useMemo } from 'react';
import { useJournalData } from '../../hooks/useJournalData';
import { JournalPromptCard } from './JournalPromptCard';
import { JournalEntry } from './JournalEntry';
import type { JournalEntry as JournalEntryType } from '../../lib/fetchers/journalFetcher';

function getWeekLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(date);
  monday.setDate(date.getDate() - diff);

  return monday.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function groupByWeek(
  entries: JournalEntryType[]
): { weekLabel: string; entries: JournalEntryType[] }[] {
  const groups = new Map<string, JournalEntryType[]>();

  for (const entry of entries) {
    const label = getWeekLabel(entry.created_at);
    const existing = groups.get(label);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(label, [entry]);
    }
  }

  return Array.from(groups.entries()).map(([weekLabel, weekEntries]) => ({
    weekLabel: `Week of ${weekLabel}`,
    entries: weekEntries,
  }));
}

export default function JournalPage() {
  const { entries, loading } = useJournalData();

  const groupedEntries = useMemo(() => groupByWeek(entries), [entries]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Your Journal</h1>
        <p className="text-sm text-gray-500 mt-1">
          Reflect on your coaching journey
        </p>
      </div>

      {/* Prompt card (full mode) */}
      <JournalPromptCard compact={false} />

      {/* Past entries */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
          Past Reflections
        </h2>

        {loading && (
          <div className="text-sm text-gray-400 py-8 text-center">
            Loading reflections...
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm text-center">
            <p className="text-sm text-gray-400">
              Your reflections will appear here after you write your first one
            </p>
          </div>
        )}

        {!loading &&
          groupedEntries.map((group) => (
            <div key={group.weekLabel} className="mb-6">
              <h3 className="text-xs font-semibold text-gray-400 mb-3">
                {group.weekLabel}
              </h3>
              <div className="space-y-3">
                {group.entries.map((entry) => (
                  <JournalEntry key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
