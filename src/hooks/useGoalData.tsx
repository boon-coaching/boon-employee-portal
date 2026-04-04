import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from '../lib/AuthContext';
import {
  fetchGoals,
  fetchWeeklyCommitments,
  fetchGoalCheckins,
  seedGoalsFromFocusAreas,
  createGoal,
  updateGoal,
  createWeeklyCommitment,
  updateCommitmentStatus,
  createGoalCheckin,
  getCurrentWeekCommitmentStatus,
  getWeekStart,
} from '../lib/fetchers/goalFetcher';
import type {
  Goal,
  WeeklyCommitment,
  GoalCheckin,
  GoalStatus,
  CommitmentStatus,
  CheckinType,
} from '../lib/types';

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};

export interface GoalData {
  // Loading state
  loading: boolean;
  error: string | null;

  // Data
  goals: Goal[];
  commitments: WeeklyCommitment[];
  checkins: GoalCheckin[];

  // Current week status (for home dashboard card)
  currentWeek: {
    hasCommitment: boolean;
    hasMidweekCheckin: boolean;
    hasEndweekCheckin: boolean;
    commitment: WeeklyCommitment | null;
  };

  // Actions
  addGoal: (title: string, description?: string, competencyArea?: string) => Promise<Goal | null>;
  editGoal: (goalId: string, updates: { title?: string; description?: string; status?: GoalStatus }) => Promise<boolean>;
  completeGoal: (goalId: string) => Promise<boolean>;
  addCommitment: (goalId: string, commitmentText: string) => Promise<WeeklyCommitment | null>;
  updateCommitment: (commitmentId: string, status: CommitmentStatus, reflectionText?: string) => Promise<boolean>;
  submitCheckin: (commitmentId: string, checkinType: CheckinType, progressRating: number, reflectionText?: string, blockers?: string) => Promise<GoalCheckin | null>;
  reload: () => Promise<void>;
}

const GoalContext = createContext<GoalData | null>(null);

interface GoalProviderProps {
  children: ReactNode;
}

export function GoalProvider({ children }: GoalProviderProps) {
  const { employee } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [commitments, setCommitments] = useState<WeeklyCommitment[]>([]);
  const [checkins, setCheckins] = useState<GoalCheckin[]>([]);
  const [currentWeek, setCurrentWeek] = useState<GoalData['currentWeek']>({
    hasCommitment: false,
    hasMidweekCheckin: false,
    hasEndweekCheckin: false,
    commitment: null,
  });

  const loadGoalData = useCallback(async () => {
    if (!employee?.company_email) return;

    const companyId = employee.company_id || '';

    setLoading(true);
    setError(null);

    try {
      // Seed goals from focus areas (no-op if goals already exist)
      await seedGoalsFromFocusAreas(employee.company_email, companyId);

      // Fetch goals, recent commitments, and current week status in parallel
      const [goalsData, commitmentsData, weekStatus] = await Promise.all([
        fetchGoals(employee.company_email),
        fetchWeeklyCommitments(employee.company_email),
        getCurrentWeekCommitmentStatus(employee.company_email),
      ]);

      devLog('[useGoalData] Data loaded:', {
        goalsCount: goalsData.length,
        commitmentsCount: commitmentsData.length,
        weekStatus,
      });

      setGoals(goalsData);
      setCommitments(commitmentsData);
      setCurrentWeek(weekStatus);

      // Fetch checkins for current week's commitment
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
      console.error('[useGoalData] Error loading goal data:', err);
      setError('Something went wrong loading your goals. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [employee?.company_email, employee?.company_id]);

  useEffect(() => {
    loadGoalData();
  }, [loadGoalData]);

  const addGoal = useCallback(async (
    title: string,
    description?: string,
    competencyArea?: string,
  ): Promise<Goal | null> => {
    if (!employee?.company_email) return null;

    const companyId = employee.company_id || '';

    try {
      const newGoal = await createGoal({
        employee_email: employee.company_email,
        company_id: companyId,
        title,
        description,
        competency_area: competencyArea,
      });
      if (newGoal) {
        setGoals(prev => [...prev, newGoal]);
      }
      return newGoal;
    } catch (err) {
      console.error('[useGoalData] Error adding goal:', err);
      return null;
    }
  }, [employee?.company_email, employee?.company_id]);

  const editGoal = useCallback(async (
    goalId: string,
    updates: { title?: string; description?: string; status?: GoalStatus },
  ): Promise<boolean> => {
    if (!employee?.company_email) return false;

    try {
      const success = await updateGoal(goalId, updates);
      if (success) {
        setGoals(prev => prev.map(g =>
          g.id === goalId ? { ...g, ...updates } : g,
        ));
      }
      return success;
    } catch (err) {
      console.error('[useGoalData] Error editing goal:', err);
      return false;
    }
  }, [employee?.company_email]);

  const completeGoal = useCallback(async (goalId: string): Promise<boolean> => {
    if (!employee?.company_email) return false;

    try {
      const success = await updateGoal(goalId, { status: 'completed' as GoalStatus });
      if (success) {
        setGoals(prev => prev.map(g =>
          g.id === goalId ? { ...g, status: 'completed' as GoalStatus } : g,
        ));
      }
      return success;
    } catch (err) {
      console.error('[useGoalData] Error completing goal:', err);
      return false;
    }
  }, [employee?.company_email]);

  const addCommitment = useCallback(async (
    goalId: string,
    commitmentText: string,
  ): Promise<WeeklyCommitment | null> => {
    if (!employee?.company_email) return null;

    const companyId = employee.company_id || '';
    const weekStart = getWeekStart();

    try {
      const newCommitment = await createWeeklyCommitment({
        employee_email: employee.company_email,
        company_id: companyId,
        goal_id: goalId,
        commitment_text: commitmentText,
        week_start: weekStart,
      });
      if (newCommitment) {
        setCommitments(prev => [...prev, newCommitment]);
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
            return {
              ...prev,
              commitment: { ...prev.commitment, status, reflection_text: reflectionText ?? prev.commitment.reflection_text },
            };
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
        setCheckins(prev => [...prev, newCheckin]);
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
    await loadGoalData();
  }, [loadGoalData]);

  const value: GoalData = {
    loading,
    error,
    goals,
    commitments,
    checkins,
    currentWeek,
    addGoal,
    editGoal,
    completeGoal,
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
