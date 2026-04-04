import { useState } from 'react';

interface MilestoneCelebrationProps {
  completedSessionCount: number;
  programType: string | null;
  totalExpected: number;
  userEmail: string;
}

const GROW_EXEC_THRESHOLDS = [3, 6, 9, 12];
const SCALE_THRESHOLDS = [6, 12, 18, 24];

const GROW_EXEC_MESSAGES: Record<number, string> = {
  3: "Great start! You're building momentum.",
  6: "Halfway through! Your commitment is paying off.",
  9: "Almost there! The finish line is in sight.",
  12: "You did it! 12 sessions complete.",
};

const SCALE_MESSAGES: Record<number, string> = {
  6: "6 sessions in! You're in a great rhythm.",
  12: "12 sessions done. That's real commitment.",
  18: "18 sessions! You're a coaching veteran.",
  24: "You did it! 24 sessions complete.",
};

export function MilestoneCelebration({
  completedSessionCount,
  programType,
  totalExpected: _totalExpected,
  userEmail,
}: MilestoneCelebrationProps) {
  void _totalExpected;

  const thresholds = programType === 'SCALE' ? SCALE_THRESHOLDS : GROW_EXEC_THRESHOLDS;
  const messages = programType === 'SCALE' ? SCALE_MESSAGES : GROW_EXEC_MESSAGES;

  // Find the highest threshold reached
  const reached = thresholds.filter(t => completedSessionCount >= t);
  if (reached.length === 0) return null;
  const milestone = reached[reached.length - 1];

  const dismissKey = `milestone_${userEmail}_${milestone}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(dismissKey) === 'true';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  function handleDismiss() {
    try {
      localStorage.setItem(dismissKey, 'true');
    } catch {
      // localStorage unavailable
    }
    setDismissed(true);
  }

  return (
    <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-[2rem] p-6 border border-emerald-100 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-1.5 text-emerald-400 hover:text-emerald-600 transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-bold text-emerald-800">
            You've completed {completedSessionCount} sessions!
          </p>
          <p className="text-sm text-emerald-600 mt-0.5">
            {messages[milestone]}
          </p>
        </div>
      </div>
    </div>
  );
}
