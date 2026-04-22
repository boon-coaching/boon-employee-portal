import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { ActionItem } from '../lib/types';
import { updateActionItemStatus } from '../lib/dataFetcher';

interface ActionItemsProps {
  items: ActionItem[];
  onUpdate: () => void;
}

// Keywords that suggest an action item might benefit from practice
const PRACTICE_KEYWORDS = ['feedback', 'conversation', 'discuss', 'tell', 'ask', 'communicate', 'delegation', 'delegate', 'difficult'];

function hasPracticeRelevance(text: string): boolean {
  const lower = text.toLowerCase();
  return PRACTICE_KEYWORDS.some(keyword => lower.includes(keyword));
}

export default function ActionItems({ items, onUpdate }: ActionItemsProps) {
  const navigate = useNavigate();
  const [updating, setUpdating] = useState<string | null>(null);

  const pendingItems = items.filter(item => item.status === 'pending');
  const completedItems = items.filter(item => item.status === 'completed');

  async function handleComplete(itemId: string) {
    setUpdating(itemId);
    const success = await updateActionItemStatus(itemId, 'completed');
    if (success) {
      toast.success('Action item completed');
      onUpdate();
    } else {
      toast.error('Could not update action item');
    }
    setUpdating(null);
  }

  async function handleDismiss(itemId: string) {
    setUpdating(itemId);
    const success = await updateActionItemStatus(itemId, 'dismissed');
    if (success) {
      toast('Action item dismissed');
      onUpdate();
    } else {
      toast.error('Could not update action item');
    }
    setUpdating(null);
  }

  function formatDueDate(dateStr: string | null) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: 'Overdue', className: 'text-boon-error bg-red-50' };
    if (diffDays === 0) return { text: 'Due today', className: 'text-orange-500 bg-orange-50' };
    if (diffDays <= 3) return { text: `Due in ${diffDays}d`, className: 'text-boon-warning bg-boon-warning/12' };
    return { text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), className: 'text-boon-charcoal/55 bg-boon-offWhite' };
  }

  if (items.length === 0) {
    return (
      <section className="bg-white rounded-card p-8 md:p-10 shadow-sm border border-boon-charcoal/[0.08]">
        <h2 className="text-xl font-extrabold text-boon-navy mb-3">Action Items</h2>
        <p className="text-boon-charcoal/55 text-sm leading-relaxed">
          No action items yet. After your next coaching session, action items from your coach will appear here.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-card p-8 md:p-10 shadow-sm border border-boon-charcoal/[0.08]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-extrabold text-boon-navy">Action Items</h2>
        {pendingItems.length > 0 && (
          <span className="px-3 py-1 bg-boon-blue/10 text-boon-blue text-xs font-bold rounded-pill">
            {pendingItems.length} pending
          </span>
        )}
      </div>

      {/* Pending Items */}
      {pendingItems.length > 0 && (
        <div className="space-y-3 mb-6">
          {pendingItems.map(item => {
            const due = formatDueDate(item.due_date);
            const isUpdating = updating === item.id;

            return (
              <div
                key={item.id}
                className={`p-5 rounded-card border-2 transition-all ${
                  isUpdating ? 'opacity-50' : 'hover:border-boon-blue/30'
                } border-boon-charcoal/[0.08] bg-gradient-to-r from-white to-boon-bg/30`}
              >
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => handleComplete(item.id)}
                    disabled={isUpdating}
                    className="mt-0.5 w-6 h-6 rounded-pill border-2 border-gray-300 hover:border-boon-blue hover:bg-boon-blue/10 transition-all flex-shrink-0 flex items-center justify-center group"
                    title="Mark as complete"
                  >
                    <svg className="w-3 h-3 text-transparent group-hover:text-boon-blue transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-boon-navy font-medium leading-relaxed">{item.action_text}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-xs text-boon-charcoal/55">From {item.coach_name.split(' ')[0]}</span>
                      {due && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-pill ${due.className}`}>
                          {due.text}
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate('/sessions'); }}
                        className="text-xs text-boon-blue font-medium hover:underline"
                      >
                        View sessions →
                      </button>
                      {/* Contextual bridge to Practice */}
                      {hasPracticeRelevance(item.action_text) && (
                        <button
                          onClick={() => navigate('/practice')}
                          className="text-xs text-boon-purple font-medium hover:underline"
                        >
                          Practice this →
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDismiss(item.id)}
                    disabled={isUpdating}
                    className="text-gray-300 hover:text-boon-charcoal/55 transition-colors p-1"
                    title="Dismiss"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Completed Items */}
      {completedItems.length > 0 && (
        <div>
          <p className="text-[11px] font-extrabold text-boon-charcoal/55 uppercase tracking-[0.18em] mb-3">Completed</p>
          <div className="space-y-2">
            {completedItems.slice(0, 3).map(item => (
              <div
                key={item.id}
                className="p-4 rounded-btn bg-boon-offWhite/50 flex items-center gap-3"
              >
                <div className="w-5 h-5 rounded-pill bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-boon-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-boon-charcoal/55 text-sm line-through">{item.action_text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
