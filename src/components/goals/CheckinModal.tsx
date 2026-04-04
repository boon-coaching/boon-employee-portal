import { useState } from 'react';

const RATING_LABELS = [
  "Didn't start",
  'Tried a little',
  'Making progress',
  'Almost there',
  'Nailed it',
];

interface CheckinModalProps {
  commitmentText: string;
  checkinType: 'midweek' | 'endweek';
  onSubmit: (rating: number, reflectionText?: string, blockers?: string) => Promise<void>;
  onClose: () => void;
}

export function CheckinModal({
  commitmentText,
  checkinType,
  onSubmit,
  onClose,
}: CheckinModalProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [reflectionText, setReflectionText] = useState('');
  const [blockers, setBlockers] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const title =
    checkinType === 'midweek' ? 'Midweek Check-in' : 'End of Week Reflection';

  async function handleSubmit() {
    if (rating === null || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(
        rating,
        reflectionText.trim() || undefined,
        blockers.trim() || undefined,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-[2rem] p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-extrabold text-boon-text">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Commitment reminder */}
        <div className="mb-6 p-4 rounded-2xl bg-boon-bg border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
            Your commitment
          </p>
          <p className="text-boon-text text-sm leading-relaxed">
            {commitmentText}
          </p>
        </div>

        {/* Progress rating */}
        <div className="mb-6">
          <p className="text-sm font-bold text-boon-text mb-3">
            How did it go?
          </p>
          <div className="flex items-center justify-between gap-2">
            {[1, 2, 3, 4, 5].map(value => (
              <button
                key={value}
                onClick={() => setRating(value)}
                className="flex flex-col items-center gap-1.5 group flex-1"
              >
                <span
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all ${
                    rating === value
                      ? 'bg-boon-blue border-boon-blue text-white scale-110'
                      : 'border-gray-200 text-gray-400 group-hover:border-boon-blue group-hover:text-boon-blue'
                  }`}
                >
                  {value}
                </span>
                <span
                  className={`text-[10px] leading-tight text-center transition-colors ${
                    rating === value
                      ? 'text-boon-blue font-bold'
                      : 'text-gray-300'
                  }`}
                >
                  {RATING_LABELS[value - 1]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Reflection */}
        <div className="mb-5">
          <label className="block text-sm font-bold text-boon-text mb-2">
            What happened?
            <span className="text-gray-300 font-normal ml-1">Optional</span>
          </label>
          <textarea
            value={reflectionText}
            onChange={e => setReflectionText(e.target.value)}
            placeholder="Share what went well, what you learned, or what surprised you..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-boon-text text-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-boon-blue/30 focus:border-boon-blue transition-all resize-none"
          />
        </div>

        {/* Blockers (midweek only) */}
        {checkinType === 'midweek' && (
          <div className="mb-6">
            <label className="block text-sm font-bold text-boon-text mb-2">
              Anything getting in the way?
              <span className="text-gray-300 font-normal ml-1">Optional</span>
            </label>
            <textarea
              value={blockers}
              onChange={e => setBlockers(e.target.value)}
              placeholder="Challenges, time constraints, unclear expectations..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-boon-text text-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-boon-blue/30 focus:border-boon-blue transition-all resize-none"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-400 font-bold text-sm hover:text-gray-600 transition-colors rounded-xl"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={rating === null || submitting}
            className="px-6 py-2.5 bg-boon-blue text-white rounded-xl font-bold text-sm hover:bg-boon-darkBlue transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {submitting ? 'Saving...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
