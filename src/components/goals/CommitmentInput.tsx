import { useState } from 'react';

interface CommitmentInputProps {
  onSubmit: (text: string) => Promise<void>;
}

export function CommitmentInput({ onSubmit }: CommitmentInputProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(text.trim());
      setText('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-2 mb-1">
      <label className="block text-xs font-bold text-boon-charcoal/55 mb-2">
        What will you do this week?
      </label>
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="e.g., Practice giving direct feedback in 1:1s"
          className="flex-1 px-4 py-2.5 rounded-btn border border-boon-charcoal/[0.08] text-boon-navy text-sm placeholder:text-boon-charcoal/40 focus:outline-none focus:ring-2 focus:ring-boon-blue/30 focus:border-boon-blue transition-all"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          disabled={submitting}
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || !text.trim()}
          className="px-5 py-2.5 bg-boon-blue text-white rounded-btn font-bold text-xs hover:bg-boon-darkBlue transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          {submitting ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            'Set'
          )}
        </button>
      </div>
    </div>
  );
}
