import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useAuth } from '../lib/AuthContext';
import type { Session, ActionItem, Goal, WeeklyCommitment, GoalCheckin, CommitmentStatus, CheckinType } from '../lib/types';
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
  fetchGoalReflection,
  upsertGoalReflection,
  fetchEmployeeGoals,
  createEmployeeGoal,
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

  // Employee reflection & self-progress
  reflection: string | null;
  selfProgress: string | null;
  updateReflection: (text: string) => Promise<void>;
  updateSelfProgress: (status: string) => Promise<void>;

  // Employee-owned goals
  employeeGoals: Goal[];
  addEmployeeGoal: (title: string) => Promise<Goal | null>;

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

  // Derived from sessions (memoized to avoid recomputing on every render)
  const coachingGoal = useMemo(() => getLatestCoachingGoal(sessions), [sessions]);
  const goalHistory = useMemo(() => getGoalHistory(sessions), [sessions]);
  const pendingActionItems = useMemo(() => getPendingActionItems(actionItems), [actionItems]);

  // Commitment/check-in data (fetched from DB)
  const [commitments, setCommitments] = useState<WeeklyCommitment[]>([]);
  const [checkins, setCheckins] = useState<GoalCheckin[]>([]);
  const [currentWeek, setCurrentWeek] = useState<GoalData['currentWeek']>({
    hasCommitment: false,
    hasMidweekCheckin: false,
    hasEndweekCheckin: false,
    commitment: null,
  });

  // Employee-owned goals
  const [employeeGoals, setEmployeeGoals] = useState<Goal[]>([]);

  // Reflection & self-progress
  const [reflection, setReflection] = useState<string | null>(null);
  const [selfProgress, setSelfProgress] = useState<string | null>(null);

  const loadCommitmentData = useCallback(async () => {
    if (!employee?.company_email) return;

    setLoading(true);
    setError(null);

    try {
      const [commitmentsData, weekStatus, reflectionData, empGoals] = await Promise.all([
        fetchWeeklyCommitments(employee.company_email),
        getCurrentWeekCommitmentStatus(employee.company_email),
        fetchGoalReflection(employee.company_email),
        fetchEmployeeGoals(employee.company_email),
      ]);

      setCommitments(commitmentsData);
      setCurrentWeek(weekStatus);
      setEmployeeGoals(empGoals);

      if (reflectionData) {
        setReflection(reflectionData.reflection);
        setSelfProgress(reflectionData.selfProgress);
      }

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

  const updateReflection = useCallback(async (text: string) => {
    if (!employee?.company_email) return;
    const goalText = coachingGoal?.goals || '';
    const success = await upsertGoalReflection({
      email: employee.company_email,
      companyId: employee.company_id || '',
      goalText,
      reflection: text,
    });
    if (success) setReflection(text);
  }, [employee?.company_email, employee?.company_id, coachingGoal?.goals]);

  const updateSelfProgress = useCallback(async (status: string) => {
    if (!employee?.company_email) return;
    const goalText = coachingGoal?.goals || '';
    const success = await upsertGoalReflection({
      email: employee.company_email,
      companyId: employee.company_id || '',
      goalText,
      selfProgress: status,
    });
    if (success) setSelfProgress(status);
  }, [employee?.company_email, employee?.company_id, coachingGoal?.goals]);

  const addEmployeeGoal = useCallback(async (title: string): Promise<Goal | null> => {
    if (!employee?.company_email) return null;
    const companyId = employee.company_id || '';
    try {
      const newGoal = await createEmployeeGoal({
        email: employee.company_email,
        companyId,
        title,
      });
      if (newGoal) {
        setEmployeeGoals(prev => [newGoal, ...prev]);
      }
      return newGoal;
    } catch (err) {
      console.error('[useGoalData] Error adding employee goal:', err);
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
    employeeGoals,
    addEmployeeGoal,
    commitments,
    checkins,
    currentWeek,
    reflection,
    selfProgress,
    updateReflection,
    updateSelfProgress,
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
