import { supabase } from '../supabase';

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};

const JOURNAL_PROMPTS = [
  "What leadership moment stood out this week?",
  "What conversation went well? What made it work?",
  "What's one thing you'd do differently if you could redo this week?",
  "When did you feel most confident at work recently?",
  "What feedback did you give or receive that mattered?",
  "What's draining your energy right now?",
  "What did you learn about yourself this week?",
  "What's one small win you haven't acknowledged yet?",
];

export interface JournalEntry {
  id: string;
  employee_email: string;
  company_id: string;
  prompt: string | null;
  body: string;
  is_shared_with_coach: boolean;
  competency_area: string | null;
  created_at: string;
}

/**
 * Returns the weekly prompt based on the current week number of the year.
 */
export function getWeeklyPrompt(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor(
    (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  const weekNumber = Math.floor(dayOfYear / 7);
  return JOURNAL_PROMPTS[weekNumber % JOURNAL_PROMPTS.length];
}

/**
 * Fetch journal entries for an employee, ordered by most recent first.
 */
export async function fetchJournalEntries(
  email: string,
  limit = 20
): Promise<JournalEntry[]> {
  devLog('[fetchJournalEntries] Fetching for:', email);

  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .ilike('employee_email', email)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching journal entries:', error);
    return [];
  }

  devLog('[fetchJournalEntries] Found:', data?.length || 0);
  return (data || []) as JournalEntry[];
}

/**
 * Create a new journal entry and return it.
 */
export async function createJournalEntry(entry: {
  employee_email: string;
  company_id: string;
  prompt?: string;
  body: string;
  competency_area?: string;
}): Promise<JournalEntry | null> {
  devLog('[createJournalEntry] Creating for:', entry.employee_email);

  const { data, error } = await supabase
    .from('journal_entries')
    .insert({
      employee_email: entry.employee_email,
      company_id: entry.company_id,
      prompt: entry.prompt || null,
      body: entry.body,
      competency_area: entry.competency_area || null,
      is_shared_with_coach: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating journal entry:', error);
    return null;
  }

  devLog('[createJournalEntry] Created:', data?.id);
  return data as JournalEntry;
}

/**
 * Update an existing journal entry (body and/or share status).
 */
export async function updateJournalEntry(
  id: string,
  updates: { body?: string; is_shared_with_coach?: boolean }
): Promise<boolean> {
  devLog('[updateJournalEntry] Updating:', id, updates);

  const { error } = await supabase
    .from('journal_entries')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating journal entry:', error);
    return false;
  }

  return true;
}

/**
 * Check if the employee has already written a journal entry this week
 * (since Monday 00:00 local time).
 */
export async function hasEntryThisWeek(email: string): Promise<boolean> {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('journal_entries')
    .select('id')
    .ilike('employee_email', email)
    .gte('created_at', monday.toISOString())
    .limit(1);

  if (error) {
    console.error('Error checking weekly entry:', error);
    return false;
  }

  return (data?.length || 0) > 0;
}
