import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from '../lib/AuthContext';
import type { Session, ActionItem, WeeklyCommitment, GoalCheckin, CommitmentStatus, CheckinType } from '../lib/types';
import {
  type CoachingGoal,
  getLatestCoachingGoal,
  getGoalHistory,
  getPendingActionItems,
  fetchWeeklyCommitments,
  createWeeklyCommitment,
  updateCommitmentStatus,
  createGoalCheckin,
  fetchGoalCheckins,
  getCurrentWeekCommitmentStatus,
  getWeekStart,
} from '../lib/fetchers/goalFetcher';

export interface GoalData {
  loading: boolean;
  error: string | null;

  // Session-anchored coaching goal (from coach)
  coachingGoal: CoachingGoal | null;
  goalHistory: CoachingGoal[];
  pendingActionItems: ActionItem[];

  // Employee-set accountability
  commitments: WeeklyCommitment[];
  checkins: GoalCheckin[];
  currentWeek: {
    hasCommitment: boolean;
    hasMidweekCheckin: boolean;
    hasEndweekCheckin: boolean;
    commitment: WeeklyCommitment | null;
  };

  // Actions
  addCommitment: (commitmentText: string) => Promise<WeeklyCommitment | null>;
  updateCommitment: (commitmentId: string, status: CommitmentStatus, reflectionText?: string) => Promise<boolean>;
  submitCheckin: (commitmentId: string, checkinType: CheckinType, progressRating: number, reflectionText?: string, blockers?: string) => Promise<GoalCheckin | null>;
  reload: () => Promise<void>;

}

const GoalContext = createContext<GoalData | null>(null);

interface GoalProviderProps {
  children: ReactNode;
  sessions: Session[];
  actionItems: ActionItem[];
}

export function GoalProvider({ children, sessions, actionItems }: GoalProviderProps) {
  const { employee } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derived from sessions (computed, not fetched)
  const coachingGoal = getLatestCoachingGoal(sessions);
  const goalHistory = getGoalHistory(sessions);
  const pendingActionItems = getPendingActionItems(actionItems);

  // Commitment/check-in data (fetched from DB)
  const [commitments, setCommitments] = useState<WeeklyCommitment[]>([]);
  const [checkins, setCheckins] = useState<GoalCheckin[]>([]);
  const [currentWeek, setCurrentWeek] = useState<GoalData['currentWeek']>({
    hasCommitment: false,
    hasMidweekCheckin: false,
    hasEndweekCheckin: false,
    commitment: null,
  });

  const loadCommitmentData = useCallback(async () => {
    if (!employee?.company_email) return;

    setLoading(true);
    setError(null);

    try {
      const [commitmentsData, weekStatus] = await Promise.all([
        fetchWeeklyCommitments(employee.company_email),
        getCurrentWeekCommitmentStatus(employee.company_email),
      ]);

      setCommitments(commitmentsData);
      setCurrentWeek(weekStatus);

      if (weekStatus.commitment) {
        const checkinsData = await fetchGoalCheckins(
          employee.company_email,
          [weekStatus.commitment.id],
        );
        setCheckins(checkinsData);
      } else {
        setCheckins([]);
      }
    } catch (err) {
      console.error('[useGoalData] Error loading commitment data:', err);
      setError('Something went wrong loading your goals.');
    } finally {
      setLoading(false);
    }
  }, [employee?.company_email]);

  useEffect(() => {
    if (employee?.company_email) {
      loadCommitmentData();
    }
  }, [loadCommitmentData]);

  const addCommitment = useCallback(async (commitmentText: string): Promise<WeeklyCommitment | null> => {
    if (!employee?.company_email) return null;

    const companyId = employee.company_id || '';
    const weekStart = getWeekStart();

    try {
      const newCommitment = await createWeeklyCommitment({
        employee_email: employee.company_email,
        company_id: companyId,
        commitment_text: commitmentText,
        week_start: weekStart,
      });
      if (newCommitment) {
        setCommitments(prev => [newCommitment, ...prev]);
        setCurrentWeek(prev => ({
          ...prev,
          hasCommitment: true,
          commitment: newCommitment,
        }));
      }
      return newCommitment;
    } catch (err) {
      console.error('[useGoalData] Error adding commitment:', err);
      return null;
    }
  }, [employee?.company_email, employee?.company_id]);

  const updateCommitment = useCallback(async (
    commitmentId: string,
    status: CommitmentStatus,
    reflectionText?: string,
  ): Promise<boolean> => {
    if (!employee?.company_email) return false;

    try {
      const success = await updateCommitmentStatus(commitmentId, status, reflectionText);
      if (success) {
        setCommitments(prev => prev.map(c =>
          c.id === commitmentId ? { ...c, status, reflection_text: reflectionText ?? c.reflection_text } : c,
        ));
        setCurrentWeek(prev => {
          if (prev.commitment?.id === commitmentId) {
            return { ...prev, commitment: { ...prev.commitment, status, reflection_text: reflectionText ?? prev.commitment.reflection_text } };
          }
          return prev;
        });
      }
      return success;
    } catch (err) {
      console.error('[useGoalData] Error updating commitment:', err);
      return false;
    }
  }, [employee?.company_email]);

  const submitCheckin = useCallback(async (
    commitmentId: string,
    checkinType: CheckinType,
    progressRating: number,
    reflectionText?: string,
    blockers?: string,
  ): Promise<GoalCheckin | null> => {
    if (!employee?.company_email) return null;

    const companyId = employee.company_id || '';

    try {
      const newCheckin = await createGoalCheckin({
        employee_email: employee.company_email,
        company_id: companyId,
        commitment_id: commitmentId,
        checkin_type: checkinType,
        progress_rating: progressRating,
        reflection_text: reflectionText,
        blockers,
      });
      if (newCheckin) {
        setCheckins(prev => [newCheckin, ...prev]);
        setCurrentWeek(prev => ({
          ...prev,
          hasMidweekCheckin: checkinType === 'midweek' ? true : prev.hasMidweekCheckin,
          hasEndweekCheckin: checkinType === 'endweek' ? true : prev.hasEndweekCheckin,
        }));
      }
      return newCheckin;
    } catch (err) {
      console.error('[useGoalData] Error submitting checkin:', err);
      return null;
    }
  }, [employee?.company_email, employee?.company_id]);

  const reload = useCallback(async () => {
    await loadCommitmentData();
  }, [loadCommitmentData]);

  const value: GoalData = {
    loading,
    error,
    coachingGoal,
    goalHistory,
    pendingActionItems,
    commitments,
    checkins,
    currentWeek,
    addCommitment,
    updateCommitment,
    submitCheckin,
    reload,
  };

  return (
    <GoalContext.Provider value={value}>
      {children}
    </GoalContext.Provider>
  );
}

export function useGoalData(): GoalData {
  const context = useContext(GoalContext);
  if (!context) {
    throw new Error('useGoalData must be used within a GoalProvider');
  }
  return context;
}
