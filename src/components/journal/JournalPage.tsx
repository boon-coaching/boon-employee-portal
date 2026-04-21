import { useMemo } from 'react';
import { useJournalData } from '../../hooks/useJournalData';
import { usePortalData } from '../ProtectedLayout';
import { JournalPromptCard } from './JournalPromptCard';
import { JournalEntry } from './JournalEntry';
import type { JournalEntry as JournalEntryType } from '../../lib/fetchers/journalFetcher';
import { JOURNAL_PROMPTS } from '../../lib/fetchers/journalFetcher';

function getWeekLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(date);
  monday.setDate(date.getDate() - diff);
  return monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function groupByWeek(entries: JournalEntryType[]): { weekLabel: string; entries: JournalEntryType[] }[] {
  const groups = new Map<string, JournalEntryType[]>();
  for (const entry of entries) {
    const label = getWeekLabel(entry.created_at);
    const existing = groups.get(label);
    if (existing) existing.push(entry);
    else groups.set(label, [entry]);
  }
  return Array.from(groups.entries()).map(([weekLabel, weekEntries]) => ({
    weekLabel: `Week of ${weekLabel}`,
    entries: weekEntries,
  }));
}

export default function JournalPage() {
  const { entries, loading } = useJournalData();
  const { sessions } = usePortalData();

  const groupedEntries = useMemo(() => groupByWeek(entries), [entries]);

  // Count unique weeks with entries for streak display
  const weeksWithEntries = useMemo(() => {
    const weeks = new Set(entries.map(e => getWeekLabel(e.created_at)));
    return weeks.size;
  }, [entries]);

  // Get coaching themes from recent sessions for context
  const coachingThemes = useMemo(() => {
    const completed = sessions
      .filter(s => s.status === 'Completed')
      .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
      .slice(0, 3);
    const themes: string[] = [];
    for (const s of completed) {
      if (s.leadership_management_skills) themes.push(s.leadership_management_skills);
      if (s.communication_skills) themes.push(s.communication_skills);
    }
    return themes.slice(0, 3);
  }, [sessions]);

  // Show how many prompts exist for rotation context
  const totalPrompts = JOURNAL_PROMPTS.length;

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-[2rem] animate-pulse" />
        <div className="h-32 bg-gray-100 rounded-[2rem] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 md:space-y-10 animate-fade-in">
      {/* Header */}
      <header className="pt-2">
        <h1 className="text-3xl md:text-4xl font-extrabold text-boon-text tracking-tight">Your Journal</h1>
        <p className="text-gray-500 mt-2 text-base font-medium">Reflect on your coaching journey</p>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
          <p className="text-2xl font-black text-boon-text">{entries.length}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Reflections</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
          <p className="text-2xl font-black text-boon-blue">{weeksWithEntries}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Weeks Active</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
          <p className="text-2xl font-black text-emerald-600">{entries.filter(e => e.is_shared_with_coach).length}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Shared</p>
        </div>
      </div>

      {/* This week's prompt */}
      <JournalPromptCard compact={false} />

      {/* Prompt rotation context */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>New prompt every week ({totalPrompts} prompts rotating)</span>
      </div>

      {/* Coaching themes context */}
      {coachingThemes.length > 0 && (
        <div className="bg-boon-lightBlue/20 border border-boon-blue/10 rounded-xl p-4">
          <p className="text-xs font-bold text-boon-blue uppercase tracking-widest mb-2">Your Coaching Themes</p>
          <p className="text-sm text-gray-600">
            Consider reflecting on: {coachingThemes.join(', ')}
          </p>
        </div>
      )}

      {/* Past entries */}
      {entries.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Past Reflections</h2>
          {groupedEntries.map((group) => (
            <div key={group.weekLabel} className="mb-6">
              <h3 className="text-xs font-semibold text-gray-400 mb-3">{group.weekLabel}</h3>
              <div className="space-y-3">
                {group.entries.map((entry) => (
                  <JournalEntry key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Empty state */}
      {entries.length === 0 && (
        <section className="bg-white rounded-[2rem] p-8 md:p-10 border border-gray-100 shadow-sm text-center">
          <div className="w-14 h-14 mx-auto mb-4 bg-boon-lightBlue rounded-2xl flex items-center justify-center">
            <svg className="w-7 h-7 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-boon-text mb-2">Start your journal</h2>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Take 2 minutes to reflect on your week. Your reflections build a record of your growth and give your coach insight into how you're thinking between sessions.
          </p>
        </section>
      )}
    </div>
  );
}
