import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { Session } from '../lib/types';
// CoachingStateData now accessed via usePortalData()
import { isAlumniState, isPreFirstSession, isUpcomingSession } from '../lib/coachingState';
import { usePortalData } from './ProtectedLayout';
import { submitSessionFeedback, updateActionItemStatus } from '../lib/dataFetcher';
import { supabase } from '../lib/supabase';

function getStatusStyle(status: Session['status']): {
  icon: 'check' | 'clock' | 'x-circle' | 'x';
  bgClass: string;
  textClass: string;
  label: string;
} {
  switch (status) {
    case 'Completed':
      return { icon: 'check', bgClass: 'bg-boon-success/10', textClass: 'text-boon-success', label: 'Completed' };
    case 'Late Cancel':
      return { icon: 'clock', bgClass: 'bg-red-50', textClass: 'text-boon-error', label: 'Late Cancel' };
    case 'Client No-Show':
      return { icon: 'x-circle', bgClass: 'bg-red-50', textClass: 'text-boon-error', label: 'No-Show' };
    case 'No Show':
      return { icon: 'x-circle', bgClass: 'bg-red-50', textClass: 'text-boon-error', label: 'No Show' };
    case 'Cancelled':
      return { icon: 'x', bgClass: 'bg-boon-offWhite', textClass: 'text-boon-charcoal/55', label: 'Cancelled' };
    case 'Upcoming':
    case 'Scheduled':
      return { icon: 'clock', bgClass: 'bg-boon-blue/10', textClass: 'text-boon-blue', label: status };
    default:
      return { icon: 'clock', bgClass: 'bg-orange-50', textClass: 'text-orange-600', label: status };
  }
}

function StatusIcon({ type }: { type: 'check' | 'clock' | 'x-circle' | 'x' }) {
  switch (type) {
    case 'check':
      return (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'clock':
      return (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'x-circle':
      return (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'x':
      return (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
  }
}

export default function SessionsPage() {
  const data = usePortalData();
  const sessions = data.recentSessions;
  const actionItems = data.actionItems;
  const reloadActionItems = data.reloadActionItems;
  const coachingState = data.coachingState;
  const isCompleted = isAlumniState(coachingState.state);
  const isPreFirst = isPreFirstSession(coachingState.state);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [filter, setFilter] = useState<'all' | 'Completed' | 'Upcoming'>(isCompleted ? 'Completed' : 'all');
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [feedbackSession, setFeedbackSession] = useState<Session | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [sessionNotes, setSessionNotes] = useState<Record<string, string>>({});
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);

  // Toggle action item status
  async function handleToggleAction(itemId: string, currentStatus: string) {
    setUpdatingItem(itemId);
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    const success = await updateActionItemStatus(itemId, newStatus);
    if (success) {
      reloadActionItems();
    }
    setUpdatingItem(null);
  }

  // Save employee notes for a session
  async function saveSessionNotes(sessionId: string) {
    const noteText = sessionNotes[sessionId];
    if (noteText === undefined) return;

    const { error } = await supabase
      .from('session_tracking')
      .update({ employee_notes: noteText })
      .eq('id', sessionId);

    if (error) {
      toast.error('Could not save notes. Please try again.');
    } else {
      toast.success('Notes saved.');
    }
  }

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());

  // Helper to extract themes from session
  // Theme columns may contain semicolon-separated values (e.g. "Career development; Leading through change")
  // Split them into individual themes for filtering and display
  const getSessionThemes = (session: Session): string[] => {
    const themes: string[] = [];
    const fields = [session.leadership_management_skills, session.communication_skills, session.mental_well_being];
    for (const field of fields) {
      if (field?.trim()) {
        for (const part of field.split(';')) {
          const trimmed = part.trim();
          if (trimmed && !themes.includes(trimmed)) {
            themes.push(trimmed);
          }
        }
      }
    }
    return themes;
  };

  // Get unique themes from all sessions, sorted by frequency (most common first)
  const allThemes = useMemo(() => {
    const themeCount = new Map<string, number>();
    sessions.forEach(s => {
      getSessionThemes(s).forEach(theme => {
        themeCount.set(theme, (themeCount.get(theme) || 0) + 1);
      });
    });
    return Array.from(themeCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([theme]) => theme);
  }, [sessions]);

  const [showAllThemes, setShowAllThemes] = useState(false);

  const filteredSessions = sessions.filter(s => {
    // Status filter
    if (filter !== 'all' && s.status !== filter) return false;

    // Theme filter - use themes from the text columns
    if (themeFilter) {
      const sessionThemes = getSessionThemes(s);
      if (!sessionThemes.includes(themeFilter)) return false;
    }

    return true;
  });

  // Group filtered sessions by month-year for visual structure
  const groupedSessions = useMemo(() => {
    const groups: { key: string; label: string; sessions: Session[] }[] = [];
    let currentKey = '';

    filteredSessions.forEach(session => {
      const date = new Date(session.session_date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (key !== currentKey) {
        currentKey = key;
        groups.push({
          key,
          label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          sessions: [],
        });
      }
      groups[groups.length - 1].sessions.push(session);
    });

    return groups;
  }, [filteredSessions]);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackSession) return;
    setIsSubmitting(true);
    setFeedbackError(null);
    try {
      const success = await submitSessionFeedback(feedbackSession.id, feedbackRating, feedbackText);
      if (!success) {
        toast.error('Unable to save feedback. Please try again.');
        setFeedbackError('Unable to save feedback. Please try again.');
        setIsSubmitting(false);
        return;
      }
      toast.success('Feedback submitted, thank you!');
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        setFeedbackSession(null);
        setIsSuccess(false);
        setFeedbackRating(0);
        setFeedbackText('');
        setFeedbackError(null);
      }, 2200);
    } catch {
      toast.error('Something went wrong. Please try again.');
      setFeedbackError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Calendar Helpers
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  // Helper to extract just the date part (YYYY-MM-DD) from a date string or timestamp
  const getDateOnly = (dateStr: string): string => {
    // Handle ISO timestamps like "2026-01-27T14:00:00.000Z"
    // or date strings like "2026-01-27"
    return dateStr.split('T')[0];
  };

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);

    const days: { day: number | null; date: string | null; sessions?: Session[] }[] = [];
    for (let i = 0; i < startDay; i++) {
      days.push({ day: null, date: null });
    }
    for (let i = 1; i <= totalDays; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const sessionsOnDay = sessions.filter(s => getDateOnly(s.session_date) === dateStr);
      days.push({ day: i, date: dateStr, sessions: sessionsOnDay });
    }
    return days;
  }, [currentDate, sessions]);

  const changeMonth = (offset: number) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const selectedDaySessions = useMemo(() => {
    if (!selectedCalendarDate) return [];
    return sessions.filter(s => getDateOnly(s.session_date) === selectedCalendarDate);
  }, [selectedCalendarDate, sessions]);

  // Pre-first-session: Show anticipation-focused empty state
  if (isPreFirst) {
    // Get the NEAREST upcoming session (sort by date ascending, take first)
    const upcomingSession = sessions
      .filter(isUpcomingSession)
      .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())[0] || null;
    const coachName = upcomingSession?.coach_name || 'your coach';

    return (
      <div className="space-y-8 animate-fade-in">
        <header className="text-center md:text-left">
          <h1 className="font-display font-bold text-boon-navy text-[36px] leading-[1.05] tracking-[-0.025em]">My Sessions</h1>
          <p className="text-boon-charcoal/55 mt-2 font-medium">Your coaching journey is just beginning.</p>
        </header>

        {/* Upcoming First Session Card */}
        {upcomingSession ? (
          <section className="bg-gradient-to-br from-boon-blue/5 via-white to-boon-lightBlue/20 rounded-card p-8 md:p-10 border-2 border-boon-blue/20 shadow-lg">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-btn bg-boon-blue flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-xs font-bold text-boon-blue uppercase tracking-widest">Your First Session</span>
            </div>

            <p className="text-2xl md:text-3xl font-extrabold text-boon-navy mb-2">
              {new Date(upcomingSession.session_date).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <p className="text-boon-charcoal/55 text-lg">
              {new Date(upcomingSession.session_date).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })} with {coachName}
            </p>
          </section>
        ) : (
          <section className="bg-white rounded-card p-8 border border-boon-charcoal/[0.08] text-center">
            <p className="text-boon-charcoal/55">
              Your first session will appear here once it's scheduled.
            </p>
          </section>
        )}

        {/* Intentional Empty State */}
        <section className="bg-white rounded-card p-8 md:p-12 border border-boon-charcoal/[0.08] text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-boon-lightBlue/30 rounded-card flex items-center justify-center">
            <svg className="w-8 h-8 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-extrabold text-boon-navy mb-3">Session Notes & History</h3>
          <p className="text-boon-charcoal/55 max-w-md mx-auto leading-relaxed">
            {upcomingSession
              ? `After your first session with ${coachName.split(' ')[0]}, you'll see notes, reflections, and key themes here.`
              : "After your first session, you'll see notes, reflections, and key themes here."
            }
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="text-center md:text-left">
          <h1 className="font-display font-bold text-boon-navy text-[36px] leading-[1.05] tracking-[-0.025em]">
            {isCompleted ? 'Session Archive' : 'My Sessions'}
          </h1>
          <p className="text-boon-charcoal/55 mt-2 font-medium">
            {isCompleted
              ? `${sessions.filter(s => s.status === 'Completed').length} coaching sessions completed`
              : 'Manage and review your coaching journey.'
            }
          </p>
        </div>
        
        {/* View Toggle */}
        <div className="flex bg-white p-1 rounded-card border border-boon-charcoal/[0.08] self-center md:self-end shadow-sm">
          <button 
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-btn text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-boon-blue text-white shadow-md' : 'text-boon-charcoal/55 hover:text-boon-blue'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            List
          </button>
          <button 
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-btn text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'calendar' ? 'bg-boon-blue text-white shadow-md' : 'text-boon-charcoal/55 hover:text-boon-blue'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Calendar
          </button>
        </div>
      </header>

      {viewMode === 'list' ? (
        <div className="space-y-8">
          <div className="overflow-x-auto pb-4 -mx-5 px-5 scrollbar-hide">
            <div className="flex flex-wrap items-center gap-4">
              {/* Status filter */}
              <div className="flex bg-white p-1.5 rounded-card border border-boon-charcoal/[0.08] shadow-sm">
                {(isCompleted
                  ? [{ id: 'all', label: 'All Sessions' }, { id: 'Completed', label: 'Completed' }]
                  : [
                      { id: 'all', label: 'All Sessions' },
                      { id: 'Completed', label: 'Completed' },
                      { id: 'Upcoming', label: 'Upcoming' }
                    ]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id as any)}
                    className={`px-6 py-3 rounded-btn text-sm font-bold transition-all whitespace-nowrap active:scale-95 ${
                      filter === tab.id ? 'bg-boon-blue text-white shadow-lg shadow-boon-blue/20' : 'text-boon-charcoal/55 hover:text-boon-blue'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Theme filter - show top 5 with expand toggle */}
              {allThemes.length > 0 && (() => {
                const MAX_VISIBLE_THEMES = 5;
                const visibleThemes = showAllThemes ? allThemes : allThemes.slice(0, MAX_VISIBLE_THEMES);
                const hiddenCount = allThemes.length - MAX_VISIBLE_THEMES;
                return (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-boon-charcoal/55 uppercase tracking-wider">Theme:</span>
                    <div className="flex flex-wrap bg-white p-1 rounded-btn border border-boon-charcoal/[0.08] shadow-sm gap-0.5">
                      <button
                        onClick={() => setThemeFilter(null)}
                        className={`px-3 py-1.5 rounded-btn text-xs font-bold transition-all ${
                          themeFilter === null ? 'bg-boon-offWhite text-boon-navy' : 'text-boon-charcoal/55 hover:text-boon-blue'
                        }`}
                      >
                        All
                      </button>
                      {visibleThemes.map(theme => (
                        <button
                          key={theme}
                          onClick={() => setThemeFilter(theme)}
                          className={`px-3 py-1.5 rounded-btn text-xs font-bold transition-all ${
                            themeFilter === theme ? 'bg-boon-blue text-white' : 'text-boon-charcoal/55 hover:text-boon-blue'
                          }`}
                        >
                          {theme}
                        </button>
                      ))}
                      {hiddenCount > 0 && (
                        <button
                          onClick={() => setShowAllThemes(!showAllThemes)}
                          className="px-3 py-1.5 rounded-btn text-xs font-bold text-boon-blue hover:bg-boon-blue/10 transition-all"
                        >
                          {showAllThemes ? 'Show less' : `+${hiddenCount} more`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="space-y-6">
            {groupedSessions.length > 0 ? groupedSessions.map((group) => (
              <div key={group.key}>
                <h3 className="text-sm font-bold text-boon-charcoal/55 uppercase tracking-[0.18em] mb-3 px-1">{group.label}</h3>
                <div className="space-y-4">
                  {group.sessions.map((session) => {
                    const isExpanded = expandedSession === session.id;
                    const sessionActionItems = actionItems.filter(a => String(a.session_id) === String(session.id));
                    const hasDetails = session.goals || session.plan || sessionActionItems.length > 0 || session.status === 'Completed';
                    const themes = getSessionThemes(session);

                    return (
                      <div
                        key={session.id}
                        className={`bg-white rounded-card shadow-sm border transition-all ${
                          isExpanded ? 'border-boon-blue/20' : 'border-boon-charcoal/[0.08] hover:border-boon-blue/10'
                        }`}
                      >
                        <div
                          className="p-6 cursor-pointer"
                          onClick={() => hasDetails && setExpandedSession(isExpanded ? null : session.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              {(() => {
                                const style = getStatusStyle(session.status);
                                return (
                                  <div className={`w-12 h-12 rounded-btn flex items-center justify-center ${style.bgClass} ${style.textClass}`}>
                                    <StatusIcon type={style.icon} />
                                  </div>
                                );
                              })()}
                              <div>
                                <p className="font-bold text-boon-navy">
                                  {new Date(session.session_date).toLocaleDateString('en-US', {
                                    weekday: 'long', month: 'long', day: 'numeric'
                                  })}
                                </p>
                                <p className="text-sm text-boon-charcoal/55">with {session.coach_name}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {(() => {
                                const style = getStatusStyle(session.status);
                                return (
                                  <span className={`px-3 py-1 rounded-pill text-xs font-bold uppercase tracking-wide ${style.bgClass} ${style.textClass}`}>
                                    {style.label}
                                  </span>
                                );
                              })()}
                              {hasDetails && (
                                <svg
                                  className={`w-5 h-5 text-boon-charcoal/55 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </div>
                          </div>

                          {/* Theme tags - always visible */}
                          {themes.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-4">
                              {themes.map((theme, i) => (
                                <span key={i} className="px-3 py-1 bg-boon-bg text-boon-charcoal/75 text-xs font-medium rounded-pill">
                                  {theme}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && hasDetails && (
                          <div className="px-6 pb-6 space-y-4 border-t border-gray-50 pt-4">
                            {themes.length > 0 && (
                              <div>
                                <h4 className="text-[11px] font-extrabold text-boon-charcoal/55 uppercase tracking-[0.18em] mb-2">Topics Discussed</h4>
                                <div className="flex flex-wrap gap-2">
                                  {themes.map((theme, i) => (
                                    <span key={i} className="px-3 py-1.5 bg-boon-lightBlue/30 text-boon-blue text-xs font-medium rounded-pill">
                                      {theme}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {session.goals && (
                              <div>
                                <h4 className="text-[11px] font-extrabold text-boon-charcoal/55 uppercase tracking-[0.18em] mb-2">Goals</h4>
                                <p className="text-sm text-boon-charcoal/75 whitespace-pre-line leading-relaxed">{session.goals}</p>
                              </div>
                            )}
                            {session.plan && (
                              <div>
                                <h4 className="text-[11px] font-extrabold text-boon-charcoal/55 uppercase tracking-[0.18em] mb-2">Plan</h4>
                                <p className="text-sm text-boon-charcoal/75 whitespace-pre-line leading-relaxed">{session.plan}</p>
                              </div>
                            )}
                            {/* Action Items from this session */}
                            {sessionActionItems.length > 0 && (
                              <div>
                                <p className="text-xs text-boon-charcoal/55 uppercase tracking-wide mb-2">Action Items</p>
                                <div className="space-y-1.5">
                                  {sessionActionItems.map(item => (
                                    <label key={item.id} className={`flex items-start gap-2 py-1 cursor-pointer ${updatingItem === item.id ? 'opacity-50' : ''} ${item.status === 'completed' ? 'text-boon-charcoal/55' : 'text-boon-charcoal/75'}`}>
                                      <input type="checkbox" checked={item.status === 'completed'} onChange={() => handleToggleAction(item.id, item.status)} disabled={updatingItem === item.id} className="mt-0.5 w-4 h-4 rounded border-boon-charcoal/[0.08] text-boon-blue focus:ring-boon-blue" />
                                      <span className={`text-sm ${item.status === 'completed' ? 'line-through' : ''}`}>{item.action_text}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* Employee Notes */}
                            {session.status === 'Completed' && (
                              <div>
                                <p className="text-xs text-boon-charcoal/55 uppercase tracking-wide mb-2">Your Takeaways</p>
                                <textarea
                                  value={sessionNotes[session.id] ?? session.employee_notes ?? ''}
                                  onChange={(e) => setSessionNotes(prev => ({ ...prev, [session.id]: e.target.value }))}
                                  onBlur={() => saveSessionNotes(session.id)}
                                  placeholder="What did you take away from this session?"
                                  className="w-full p-3 rounded-btn border border-boon-charcoal/[0.08] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-boon-blue/20 focus:border-boon-blue"
                                  rows={3}
                                />
                              </div>
                            )}
                            {session.status === 'Completed' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setFeedbackSession(session); }}
                                className="px-4 py-2 text-xs font-bold text-boon-blue bg-boon-lightBlue/30 rounded-btn hover:bg-boon-lightBlue transition-all"
                              >
                                Give Feedback
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )) : (
              <div className="text-center py-12 bg-white rounded-card border border-boon-charcoal/[0.08]">
                <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-boon-charcoal/55 font-medium mb-1">No upcoming sessions</p>
                <p className="text-boon-charcoal/55 text-sm">Your next session will appear here once it's scheduled.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Calendar View */
        <div className="space-y-6">
          <div className="bg-white rounded-card p-6 md:p-8 shadow-sm border border-boon-charcoal/[0.08]">
            <div className="flex items-center justify-between mb-8">
              <button 
                onClick={() => changeMonth(-1)}
                className="p-2 hover:bg-boon-bg rounded-btn transition-colors"
              >
                <svg className="w-5 h-5 text-boon-charcoal/55" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h3 className="text-xl font-black text-boon-navy">
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <button 
                onClick={() => changeMonth(1)}
                className="p-2 hover:bg-boon-bg rounded-btn transition-colors"
              >
                <svg className="w-5 h-5 text-boon-charcoal/55" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-[10px] font-black text-boon-charcoal/55 uppercase tracking-widest py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((dayObj, idx) => (
                <button
                  key={idx}
                  onClick={() => dayObj.date && setSelectedCalendarDate(dayObj.date)}
                  disabled={!dayObj.day}
                  className={`aspect-square p-1 rounded-btn flex flex-col items-center justify-center transition-all ${
                    !dayObj.day 
                      ? 'invisible' 
                      : selectedCalendarDate === dayObj.date
                        ? 'bg-boon-blue text-white'
                        : dayObj.sessions && dayObj.sessions.length > 0
                          ? 'bg-boon-lightBlue text-boon-blue hover:bg-boon-blue hover:text-white'
                          : 'hover:bg-boon-bg'
                  }`}
                >
                  <span className="text-sm font-bold">{dayObj.day}</span>
                  {dayObj.sessions && dayObj.sessions.length > 0 && (
                    <div className={`w-1.5 h-1.5 rounded-pill mt-0.5 ${
                      selectedCalendarDate === dayObj.date ? 'bg-white' : 'bg-boon-blue'
                    }`} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {selectedCalendarDate && (
            <div className="bg-white rounded-card p-6 shadow-sm border border-boon-charcoal/[0.08]">
              <h4 className="font-bold text-boon-navy mb-4">
                {new Date(selectedCalendarDate + 'T12:00:00').toLocaleDateString('en-US', { 
                  weekday: 'long', month: 'long', day: 'numeric' 
                })}
              </h4>
              {selectedDaySessions.length > 0 ? selectedDaySessions.map(session => (
                <div key={session.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="font-bold text-boon-navy">{session.coach_name}</p>
                    {(() => {
                      const style = getStatusStyle(session.status);
                      return (
                        <p className={`text-xs font-bold uppercase ${style.textClass}`}>
                          {style.label}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              )) : (
                <p className="text-boon-charcoal/55 text-sm">No sessions on this day.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Feedback Modal */}
      {feedbackSession && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div 
            className="absolute inset-0 bg-boon-text/40 backdrop-blur-md" 
            onClick={() => !isSubmitting && setFeedbackSession(null)}
          />
          <div className="relative bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl">
            <div className="w-12 h-1.5 bg-boon-offWhite rounded-pill mx-auto mt-4 mb-2 sm:hidden" />
            <div className="p-8 sm:p-12">
              {isSuccess ? (
                <div className="py-12 text-center">
                  <div className="w-20 h-20 bg-boon-success/10 text-boon-success rounded-pill flex items-center justify-center mx-auto mb-8">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-3xl font-black text-boon-navy">Thank You!</h3>
                  <p className="text-boon-charcoal/55 mt-3">Your feedback helps us improve.</p>
                </div>
              ) : (
                <form onSubmit={handleFeedbackSubmit} className="space-y-8">
                  <header className="text-center">
                    <h3 className="text-2xl font-black text-boon-navy">Session Feedback</h3>
                    <p className="text-boon-charcoal/55 mt-2">How was your session with {feedbackSession.coach_name}?</p>
                  </header>

                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        className={`p-1 transition-all transform hover:scale-110 ${
                          feedbackRating >= star ? 'text-boon-blue' : 'text-boon-charcoal/20'
                        }`}
                      >
                        <svg className="w-10 h-10 fill-current" viewBox="0 0 24 24">
                          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Any additional thoughts? (optional)"
                    className="w-full px-5 py-4 bg-boon-bg border-2 border-transparent rounded-card focus:bg-white focus:border-boon-blue outline-none resize-none h-32"
                  />

                  {feedbackError && (
                    <p className="text-boon-error text-sm text-center font-medium">{feedbackError}</p>
                  )}

                  <div className="flex flex-col gap-3">
                    <button
                      type="submit"
                      disabled={feedbackRating === 0 || isSubmitting}
                      className="w-full py-4 bg-boon-blue text-white rounded-card font-bold uppercase tracking-widest text-xs disabled:bg-boon-offWhite disabled:text-boon-charcoal/55 transition-all"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedbackSession(null)}
                      disabled={isSubmitting}
                      className="py-3 text-boon-charcoal/55 font-bold text-xs uppercase tracking-widest"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
