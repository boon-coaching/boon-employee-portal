import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import {
  type JournalEntry,
  getWeeklyPrompt,
  fetchJournalEntries,
  createJournalEntry,
  updateJournalEntry,
  hasEntryThisWeek as checkHasEntryThisWeek,
} from '../lib/fetchers/journalFetcher';

export interface JournalData {
  entries: JournalEntry[];
  loading: boolean;
  weeklyPrompt: string;
  hasEntryThisWeek: boolean;
  addEntry: (body: string, competencyArea?: string) => Promise<JournalEntry | null>;
  toggleShare: (entryId: string, shared: boolean) => Promise<boolean>;
}

export function useJournalData(): JournalData {
  const { employee } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasEntry, setHasEntry] = useState(false);

  const weeklyPrompt = getWeeklyPrompt();

  const loadData = useCallback(async () => {
    if (!employee?.company_email) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [fetchedEntries, weekCheck] = await Promise.all([
        fetchJournalEntries(employee.company_email),
        checkHasEntryThisWeek(employee.company_email),
      ]);
      setEntries(fetchedEntries);
      setHasEntry(weekCheck);
    } catch (err) {
      console.error('Error loading journal data:', err);
    } finally {
      setLoading(false);
    }
  }, [employee?.company_email]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addEntry = useCallback(
    async (body: string, competencyArea?: string): Promise<JournalEntry | null> => {
      if (!employee?.company_email || !employee?.company_id) return null;

      const created = await createJournalEntry({
        employee_email: employee.company_email,
        company_id: employee.company_id,
        prompt: weeklyPrompt,
        body,
        competency_area: competencyArea,
      });

      if (created) {
        setEntries((prev) => [created, ...prev]);
        setHasEntry(true);
      }

      return created;
    },
    [employee?.company_email, employee?.company_id, weeklyPrompt]
  );

  const toggleShare = useCallback(
    async (entryId: string, shared: boolean): Promise<boolean> => {
      const success = await updateJournalEntry(entryId, {
        is_shared_with_coach: shared,
      });

      if (success) {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entryId ? { ...e, is_shared_with_coach: shared } : e
          )
        );
      }

      return success;
    },
    []
  );

  return {
    entries,
    loading,
    weeklyPrompt,
    hasEntryThisWeek: hasEntry,
    addEntry,
    toggleShare,
  };
}
