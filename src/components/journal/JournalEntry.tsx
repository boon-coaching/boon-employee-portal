import { useState } from 'react';
import type { JournalEntry as JournalEntryType } from '../../lib/fetchers/journalFetcher';
import { useJournalData } from '../../hooks/useJournalData';

interface JournalEntryProps {
  entry: JournalEntryType;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function JournalEntry({ entry }: JournalEntryProps) {
  const { toggleShare } = useJournalData();
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(entry.is_shared_with_coach);

  async function handleToggleShare() {
    setSharing(true);
    const newShared = !shared;
    const success = await toggleShare(entry.id, newShared);
    if (success) {
      setShared(newShared);
    }
    setSharing(false);
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 font-medium">
          {formatDate(entry.created_at)}
        </span>
        <div className="flex items-center gap-2">
          {entry.competency_area && (
            <span className="text-xs bg-indigo-50 text-indigo-600 font-medium rounded-full px-2.5 py-0.5">
              {entry.competency_area}
            </span>
          )}
          {shared && (
            <span className="text-xs bg-emerald-50 text-emerald-600 font-medium rounded-full px-2.5 py-0.5 flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 1a5 5 0 100 10A5 5 0 006 1zM5.25 7.75l3-3-.75-.75-2.25 2.25-1.5-1.5-.75.75 2.25 2.25z" fill="currentColor" />
              </svg>
              Shared
            </span>
          )}
        </div>
      </div>

      {entry.prompt && (
        <p className="text-sm italic text-gray-400 mb-2">{entry.prompt}</p>
      )}

      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
        {entry.body}
      </p>

      <div className="mt-3 pt-3 border-t border-gray-50">
        <button
          onClick={handleToggleShare}
          disabled={sharing}
          className="text-xs text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
        >
          {sharing
            ? 'Updating...'
            : shared
              ? 'Unshare with coach'
              : 'Share with coach'}
        </button>
      </div>
    </div>
  );
}
