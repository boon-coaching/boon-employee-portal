import { useState, useEffect, useCallback } from 'react';
import type { Session, ActionItem } from '../lib/types';
import { isUpcomingSession } from '../lib/coachingState';
import { supabase } from '../lib/supabase';
import { updateActionItemStatus } from '../lib/dataFetcher';
import { useGoalData } from '../hooks/useGoalData';
import { useJournalData } from '../hooks/useJournalData';
import { ResourceSuggestion } from './ResourceSuggestion';

interface SessionPrepProps {
  sessions: Session[];
  actionItems: ActionItem[];
  coachName: string;
  userEmail: string;
  onActionUpdate?: () => void;
}

export default function SessionPrep({ sessions, actionItems, coachName, userEmail: _userEmail, onActionUpdate }: SessionPrepProps) {
  const { currentWeek, selfProgress } = useGoalData();
  const { entries: journalEntries } = useJournalData();

  const completedSessions = sessions
    .filter(s => s.status === 'Completed')
    .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

  // Filter action items to pending items from the last 3 completed sessions
  const recentSessionIds = completedSessions.slice(0, 3).map(s => s.id);
  const oldestRecentSession = completedSessions[2] || completedSessions[completedSessions.length - 1];
  const oldestRecentDate = oldestRecentSession ? new Date(oldestRecentSession.session_date).getTime() : 0;
  const recentPendingItems = actionItems.filter(a => {
    if (a.status === 'completed') return false;
    // Include if session_id matches one of the recent sessions
    if (a.session_id !== null && recentSessionIds.includes(String(a.session_id))) return true;
    // Include items with no session_id that were created after the oldest recent session
    if (a.session_id === null && new Date(a.created_at).getTime() >= oldestRecentDate) return true;
    return false;
  });
  const recentSessionCount = Math.min(3, completedSessions.length);

  // Get the NEAREST upcoming session (sort by date ascending, take first)
  const upcomingSession = sessions
    .filter(isUpcomingSession)
    .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())[0] || null;

  // Find most recent session with goals or plan (for showing relevant context)
  const sessionWithGoals = completedSessions.find(s => s.goals || s.plan) || null;

  // Count entries since last completed session
  const lastSessionDate = completedSessions[0]?.session_date;
  const entriesSinceLastSession = lastSessionDate
    ? journalEntries.filter(e => new Date(e.created_at) > new Date(lastSessionDate)).length
    : journalEntries.length;

  // Session prep state
  const [goalReflection, setGoalReflection] = useState('');
  const [actionReflection, setActionReflection] = useState('');
  const [openEnded, setOpenEnded] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);

  // Toggle action item status
  const handleToggleAction = async (itemId: string, currentStatus: string) => {
    setUpdatingItem(itemId);
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    const success = await updateActionItemStatus(itemId, newStatus);
    if (success && onActionUpdate) {
      onActionUpdate();
    }
    setUpdatingItem(null);
  };

  const coachFirstName = coachName.split(' ')[0];

  // Check if session is within 24 hours
  const isWithin24Hours = upcomingSession ? (() => {
    const sessionTime = new Date(upcomingSession.session_date).getTime();
    const now = Date.now();
    const hoursUntilSession = (sessionTime - now) / (1000 * 60 * 60);
    return hoursUntilSession <= 24 && hoursUntilSession > -1; // Show from 24h before until 1h after start
  })() : false;

  // Format session date/time nicely
  const formatSessionDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return { dayName, monthDay, time, full: `${dayName}, ${monthDay}` };
  };

  // Load existing note from session_tracking, parsing structured format
  useEffect(() => {
    if (upcomingSession?.employee_pre_session_note) {
      const note = upcomingSession.employee_pre_session_note;
      // Try to parse structured format
      const goalMatch = note.match(/Goal progress: ([\s\S]*?)(?=\n\nAction items:|\n\nOther:|$)/);
      const actionMatch = note.match(/Action items: ([\s\S]*?)(?=\n\nOther:|$)/);
      const otherMatch = note.match(/Other: ([\s\S]*?)$/);

      if (goalMatch || actionMatch || otherMatch) {
        if (goalMatch) setGoalReflection(goalMatch[1].trim());
        if (actionMatch) setActionReflection(actionMatch[1].trim());
        if (otherMatch) setOpenEnded(otherMatch[1].trim());
      } else {
        // Legacy: put entire note in open-ended
        setOpenEnded(note);
      }
    }
  }, [upcomingSession]);

  // Save all structured notes to session_tracking.employee_pre_session_note
  const saveAllNotes = useCallback(async () => {
    if (!upcomingSession) return;
    setIsSaving(true);

    // Combine structured answers into a single note
    const parts: string[] = [];
    if (goalReflection.trim()) parts.push(`Goal progress: ${goalReflection.trim()}`);
    if (actionReflection.trim()) parts.push(`Action items: ${actionReflection.trim()}`);
    if (openEnded.trim()) parts.push(`Other: ${openEnded.trim()}`);
    const combinedNote = parts.join('\n\n');

    try {
      const { error } = await supabase
        .from('session_tracking')
        .update({ employee_pre_session_note: combinedNote })
        .eq('id', upcomingSession.id);
      if (!error) setLastSaved(new Date());
    } catch (e) {
      console.error('Failed to save pre-session note:', e);
    }
    setIsSaving(false);
  }, [upcomingSession, goalReflection, actionReflection, openEnded]);

  // If no upcoming session, show a different message
  if (!upcomingSession) {
    return (
      <section className="relative bg-gradient-to-br from-boon-blue/5 via-white to-boon-lightBlue/20 rounded-[2.5rem] p-8 md:p-10 border-2 border-boon-blue/20 shadow-lg overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-boon-blue/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-boon-blue flex items-center justify-center flex-shrink-0 shadow-lg shadow-boon-blue/30">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-boon-text">No upcoming session</h2>
              <p className="text-sm text-gray-500">Book a session to continue your coaching journey</p>
            </div>
          </div>
          <a
            href="mailto:hello@boon-health.com?subject=Book%20a%20Coaching%20Session"
            className="inline-flex items-center gap-2 px-6 py-3 bg-boon-blue text-white font-bold rounded-xl hover:bg-boon-darkBlue transition-all shadow-lg shadow-boon-blue/20"
          >
            Book a session
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </section>
    );
  }

  const sessionDateTime = upcomingSession ? formatSessionDateTime(upcomingSession.session_date) : null;

  return (
    <section className="relative bg-gradient-to-br from-boon-blue/5 via-white to-boon-lightBlue/20 rounded-[2.5rem] p-8 md:p-10 border-2 border-boon-blue/20 shadow-lg overflow-hidden">
      {/* Decorative element */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-boon-blue/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-100/30 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

      <div className="relative z-10">
        {/* Header with prominent session info */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-boon-blue flex items-center justify-center flex-shrink-0 shadow-lg shadow-boon-blue/30">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-boon-text">Session with {coachFirstName}</h2>
              <p className="text-sm text-gray-600 mt-0.5 font-medium">
                {sessionDateTime?.dayName}, {sessionDateTime?.monthDay} at {sessionDateTime?.time}
              </p>
            </div>
          </div>

          {/* Join Session Button - appears 24h before */}
          {isWithin24Hours && upcomingSession.zoom_join_link && (
            <a
              href={upcomingSession.zoom_join_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-600/30 animate-pulse hover:animate-none"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Join Session
            </a>
          )}
        </div>

        {/* Since Your Last Session */}
        {completedSessions.length > 0 && (
          <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-gray-100 mb-6">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Since your last session</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-black text-boon-text">{entriesSinceLastSession}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Reflections</p>
              </div>
              <div>
                <p className="text-lg font-black text-boon-text">
                  {currentWeek.hasCommitment ? (currentWeek.hasMidweekCheckin || currentWeek.hasEndweekCheckin ? '✓' : '—') : '—'}
                </p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Check-ins</p>
              </div>
              <div>
                <p className="text-lg font-black text-boon-text">
                  {selfProgress === 'feeling_confident' ? '💪' : selfProgress === 'working_on_it' ? '🔄' : '—'}
                </p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Goal Status</p>
              </div>
            </div>
          </div>
        )}

        {/* Prepare for your session label */}
        <p className="text-xs font-bold text-boon-blue uppercase tracking-widest mb-4">Prepare for your session</p>

        {/* Context Section */}
        <div className="mb-8 space-y-4">
          {/* Current Goal - from most recent session with goals */}
          {sessionWithGoals?.goals && (
            <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Current Goal</p>
              <p className="text-sm text-gray-700">{sessionWithGoals.goals}</p>
            </div>
          )}

          {/* Action Items - from action_items table */}
          {recentPendingItems.length > 0 && (
            <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Action Items from your last {recentSessionCount} session{recentSessionCount !== 1 ? 's' : ''}
              </p>
              <div className="space-y-2">
                {recentPendingItems.slice(0, 5).map((item) => {
                  const isCompleted = item.status === 'completed';
                  const isUpdating = updatingItem === item.id;

                  return (
                    <label
                      key={item.id}
                      className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                        isCompleted
                          ? 'bg-green-50/50 text-gray-400'
                          : 'hover:bg-white text-gray-700'
                      } ${isUpdating ? 'opacity-50' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isCompleted}
                        disabled={isUpdating}
                        onChange={() => handleToggleAction(item.id, item.status)}
                        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-boon-blue focus:ring-boon-blue"
                      />
                      <span className={`text-sm ${isCompleted ? 'line-through' : ''}`}>
                        {item.action_text}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Guided Session Prep */}
        <div className="space-y-4">
          {/* Goal-specific prompt (only if they have a coaching goal) */}
          {sessionWithGoals?.goals && (
            <div>
              <label className="block text-sm font-bold text-boon-text mb-2">
                How's your goal going?
              </label>
              <p className="text-xs text-gray-400 mb-2 italic">"{sessionWithGoals.goals.slice(0, 100)}{sessionWithGoals.goals.length > 100 ? '...' : ''}"</p>
              <textarea
                value={goalReflection}
                onChange={(e) => setGoalReflection(e.target.value)}
                placeholder="What progress have you made? What's been challenging?"
                className="w-full p-4 rounded-xl border-2 border-gray-100 focus:border-boon-blue focus:ring-0 focus:outline-none text-sm min-h-[80px] resize-none bg-white shadow-sm placeholder-gray-400 transition-all"
                rows={3}
              />
            </div>
          )}

          {/* Action items prompt (only if they have pending items) */}
          {recentPendingItems.length > 0 && (
            <div>
              <label className="block text-sm font-bold text-boon-text mb-2">
                Which action items do you want to discuss?
              </label>
              <textarea
                value={actionReflection}
                onChange={(e) => setActionReflection(e.target.value)}
                placeholder="Any progress, blockers, or questions about your action items?"
                className="w-full p-4 rounded-xl border-2 border-gray-100 focus:border-boon-blue focus:ring-0 focus:outline-none text-sm min-h-[60px] resize-none bg-white shadow-sm placeholder-gray-400 transition-all"
                rows={2}
              />
            </div>
          )}

          {/* Open-ended */}
          <div>
            <label className="block text-sm font-bold text-boon-text mb-2">
              Anything else on your mind?
            </label>
            <textarea
              value={openEnded}
              onChange={(e) => setOpenEnded(e.target.value)}
              placeholder="Big or small, what do you want to make sure you talk about?"
              className="w-full p-4 rounded-xl border-2 border-gray-100 focus:border-boon-blue focus:ring-0 focus:outline-none text-sm min-h-[80px] resize-none bg-white shadow-sm placeholder-gray-400 transition-all"
              rows={3}
            />
          </div>

          {/* Save + coach visibility note */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-boon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {coachFirstName} will see this before your session
            </p>
            <div className="flex items-center gap-3">
              {lastSaved && !isSaving && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </span>
              )}
              <button
                onClick={saveAllNotes}
                disabled={isSaving || (!goalReflection.trim() && !actionReflection.trim() && !openEnded.trim())}
                className="px-4 py-2 bg-boon-blue text-white text-sm font-semibold rounded-xl hover:bg-boon-darkBlue transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>

        {/* Resource suggestion */}
        {sessionWithGoals && (
          <div className="mt-6">
            <ResourceSuggestion
              sessionThemes={{
                leadership: !!sessionWithGoals.leadership_management_skills,
                communication: !!sessionWithGoals.communication_skills,
                wellbeing: !!sessionWithGoals.mental_well_being,
              }}
              label="Review before your session"
            />
          </div>
        )}
      </div>
    </section>
  );
}
