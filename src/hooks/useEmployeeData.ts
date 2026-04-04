import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};
import { fetchSessions, fetchProgressData, fetchBaseline, fetchWelcomeSurveyScale, fetchCompetencyScores, fetchProgramType, fetchActionItems, fetchReflection, fetchCheckpoints, fetchPendingSurvey, fetchCoachingWins, addCoachingWin, deleteCoachingWin, updateCoachingWin, fetchWelcomeSurveyLink } from '../lib/dataFetcher';
import { getCoachingState, type CoachingStateData, type CoachingState } from '../lib/coachingState';
import type { Session, SurveyResponse, BaselineSurvey, WelcomeSurveyScale, CompetencyScore, ProgramType, ActionItem, ReflectionResponse, Checkpoint, PendingSurvey, CoachingWin } from '../lib/types';

export interface EmployeeData {
  // Auth
  loading: boolean;
  employee: ReturnType<typeof useAuth>['employee'];

  // Data loading
  dataLoading: boolean;
  dataError: string | null;
  retryLoadData: () => void;

  // Core data
  sessions: Session[];
  recentSessions: Session[];
  effectiveSessions: Session[];
  progress: SurveyResponse[];
  baseline: BaselineSurvey | null;
  effectiveBaseline: BaselineSurvey | null;
  welcomeSurveyScale: WelcomeSurveyScale | null;
  competencyScores: CompetencyScore[];
  programType: ProgramType | null;
  effectiveProgramType: ProgramType | string | null;
  actionItems: ActionItem[];
  effectiveActionItems: ActionItem[];
  reflection: ReflectionResponse | null;
  checkpoints: Checkpoint[];
  coachingWins: CoachingWin[];
  welcomeSurveyLink: string | null;

  // Coaching state
  actualCoachingState: CoachingStateData;
  coachingState: CoachingStateData;

  // Survey
  pendingSurvey: PendingSurvey | null;
  showSurveyModal: boolean;

  // Modal state
  showReflectionFlow: boolean;
  showCheckpointFlow: boolean;

  // Admin preview
  stateOverride: CoachingState | null;
  programTypeOverride: string | null;

  // Actions
  reloadActionItems: () => Promise<void>;
  handleStartReflection: () => void;
  handleStartCheckpoint: () => void;
  handleReflectionComplete: (newReflection: ReflectionResponse) => void;
  handleCheckpointComplete: (newCheckpoint: Checkpoint) => void;
  handleSurveyComplete: () => Promise<void>;
  handleAddWin: (winText: string) => Promise<boolean>;
  handleDeleteWin: (winId: string) => Promise<boolean>;
  handleUpdateWin: (winId: string, winText: string) => Promise<boolean>;
  setShowReflectionFlow: (show: boolean) => void;
  setShowCheckpointFlow: (show: boolean) => void;
  setShowSurveyModal: (show: boolean) => void;
  setStateOverride: (state: CoachingState | null) => void;
  setProgramTypeOverride: (type: string | null) => void;
  setReflection: (reflection: ReflectionResponse | null) => void;
  setCheckpoints: React.Dispatch<React.SetStateAction<Checkpoint[]>>;
}

export function useEmployeeData(): EmployeeData {
  const { employee, loading } = useAuth();

  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [progress, setProgress] = useState<SurveyResponse[]>([]);
  const [baseline, setBaseline] = useState<BaselineSurvey | null>(null);
  const [competencyScores, setCompetencyScores] = useState<CompetencyScore[]>([]);
  const [programType, setProgramType] = useState<ProgramType | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [reflection, setReflection] = useState<ReflectionResponse | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [welcomeSurveyScale, setWelcomeSurveyScale] = useState<WelcomeSurveyScale | null>(null);
  const [coachingWins, setCoachingWins] = useState<CoachingWin[]>([]);
  const [welcomeSurveyLink, setWelcomeSurveyLink] = useState<string | null>(null);
  const [showReflectionFlow, setShowReflectionFlow] = useState(false);
  const [showCheckpointFlow, setShowCheckpointFlow] = useState(false);
  const [stateOverride, setStateOverride] = useState<CoachingState | null>(null);
  const [programTypeOverride, setProgramTypeOverride] = useState<string | null>(null);

  const [retryCount, setRetryCount] = useState(0);

  // Native survey system state
  const [pendingSurvey, setPendingSurvey] = useState<PendingSurvey | null>(null);
  const [showSurveyModal, setShowSurveyModal] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!employee?.id || !employee?.company_email) return;

      devLog('[App.loadData] Employee data:', {
        id: employee.id,
        company_email: employee.company_email,
        coach_id: employee.coach_id,
        booking_link: employee.booking_link ? 'SET' : 'NOT_SET',
        coaching_program: employee.coaching_program,
        status: employee.status
      });

      setDataLoading(true);
      setDataError(null);
      try {
        const [sessionsData, progressData, baselineData, welcomeSurveyScaleData, competencyData, programTypeData, actionItemsData, reflectionData, checkpointsData, winsData, welcomeSurveyLinkData] = await Promise.all([
          fetchSessions(employee.id, employee.company_email),
          fetchProgressData(employee.company_email),
          fetchBaseline(employee.company_email),
          fetchWelcomeSurveyScale(employee.company_email),
          fetchCompetencyScores(employee.company_email),
          fetchProgramType(employee.coaching_program),
          fetchActionItems(employee.company_email),
          fetchReflection(employee.company_email),
          fetchCheckpoints(employee.company_email),
          fetchCoachingWins(employee.company_email),
          employee.company_id ? fetchWelcomeSurveyLink(employee.company_id, employee.coaching_program) : Promise.resolve(null),
        ]);

        devLog('[App.loadData] Sessions loaded:', {
          count: sessionsData.length,
          sessions: sessionsData.map(s => ({ id: s.id, employee_id: s.employee_id, status: s.status, coach_name: s.coach_name }))
        });

        devLog('[App.loadData] Data loaded:', {
          sessionsCount: sessionsData.length,
          progressCount: progressData.length,
          hasBaseline: !!baselineData,
          hasWelcomeSurveyScale: !!welcomeSurveyScaleData,
          welcomeSurveyScaleData: welcomeSurveyScaleData,
          competencyCount: competencyData.length,
          programType: programTypeData,
          employeeProgram: employee.coaching_program,
          actionItemsCount: actionItemsData.length,
          hasReflection: !!reflectionData,
          checkpointsCount: checkpointsData.length,
          winsCount: winsData.length,
        });

        setSessions(sessionsData);
        setProgress(progressData);
        setBaseline(baselineData);
        setWelcomeSurveyScale(welcomeSurveyScaleData);
        setCompetencyScores(competencyData);

        // Derive program type - multiple fallback strategies
        let finalProgramType = programTypeData;

        if (!finalProgramType && sessionsData.length > 0) {
          const sessionProgramName = sessionsData[0]?.program_name?.toUpperCase() || '';
          devLog('[App.loadData] Fallback 1: checking session program_name:', sessionProgramName);
          if (sessionProgramName.includes('SCALE') || sessionProgramName.includes('SLX')) {
            finalProgramType = 'SCALE';
          } else if (sessionProgramName.includes('GROW')) {
            finalProgramType = 'GROW';
          } else if (sessionProgramName.includes('EXEC')) {
            finalProgramType = 'EXEC';
          }
        }

        if (!finalProgramType && welcomeSurveyScaleData) {
          devLog('[App.loadData] Fallback 2: User has welcome_survey_scale, deriving SCALE');
          finalProgramType = 'SCALE';
        }

        if (!finalProgramType && baselineData?.program_type) {
          const baselineProgram = baselineData.program_type.toUpperCase();
          devLog('[App.loadData] Fallback 3: checking baseline.program_type:', baselineProgram);
          if (baselineProgram.includes('GROW')) {
            finalProgramType = 'GROW';
          } else if (baselineProgram.includes('EXEC')) {
            finalProgramType = 'EXEC';
          } else if (baselineProgram.includes('SCALE') || baselineProgram.includes('SLX')) {
            finalProgramType = 'SCALE';
          }
        }

        if (!finalProgramType && baselineData && !welcomeSurveyScaleData) {
          devLog('[App.loadData] Fallback 4: User has baseline but no welcome_survey_scale, defaulting to GROW');
          finalProgramType = 'GROW';
        }

        setProgramType(finalProgramType);

        // Action items are already filtered to last 90 days at the query level
        setActionItems(actionItemsData);
        setReflection(reflectionData);
        setCheckpoints(checkpointsData);
        setCoachingWins(winsData);
        setWelcomeSurveyLink(welcomeSurveyLinkData);

        // Check for pending survey after data loads
        const pending = await fetchPendingSurvey(employee.company_email, finalProgramType, sessionsData);
        if (pending) {
          setPendingSurvey(pending);
          setShowSurveyModal(true);
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setDataError('Something went wrong loading your data. Please try refreshing.');
      } finally {
        setDataLoading(false);
      }
    }

    loadData();
  }, [employee?.id, employee?.company_email, employee?.coaching_program, retryCount]);

  async function reloadActionItems() {
    if (!employee?.company_email) return;
    const items = await fetchActionItems(employee.company_email);
    setActionItems(items);
  }

  function handleReflectionComplete(newReflection: ReflectionResponse) {
    setReflection(newReflection);
    setShowReflectionFlow(false);
  }

  function handleCheckpointComplete(newCheckpoint: Checkpoint) {
    setCheckpoints(prev => [...prev, newCheckpoint]);
    setShowCheckpointFlow(false);
  }

  async function handleSurveyComplete() {
    setShowSurveyModal(false);
    setPendingSurvey(null);
    if (employee?.company_email) {
      const updatedWins = await fetchCoachingWins(employee.company_email);
      setCoachingWins(updatedWins);
    }
  }

  const handleStartReflection = () => setShowReflectionFlow(true);
  const handleStartCheckpoint = () => setShowCheckpointFlow(true);

  const handleAddWin = async (winText: string): Promise<boolean> => {
    if (!employee) return false;
    const result = await addCoachingWin(employee.company_email, employee.id, winText);
    if (result.success) {
      const updatedWins = await fetchCoachingWins(employee.company_email);
      setCoachingWins(updatedWins);
      return true;
    }
    return false;
  };

  const handleDeleteWin = async (winId: string): Promise<boolean> => {
    if (!employee) return false;
    const result = await deleteCoachingWin(winId);
    if (result.success) {
      const updatedWins = await fetchCoachingWins(employee.company_email);
      setCoachingWins(updatedWins);
      return true;
    }
    return false;
  };

  const handleUpdateWin = async (winId: string, winText: string): Promise<boolean> => {
    if (!employee) return false;
    const result = await updateCoachingWin(winId, winText);
    if (result.success) {
      const updatedWins = await fetchCoachingWins(employee.company_email);
      setCoachingWins(updatedWins);
      return true;
    }
    return false;
  };

  // Compute coaching state
  const defaultCoachingState: CoachingStateData = {
    state: 'NOT_SIGNED_UP',
    hasProgram: false,
    hasCoach: false,
    hasBaseline: false,
    hasCompletedSessions: false,
    hasUpcomingSession: false,
    completedSessionCount: 0,
    totalExpectedSessions: 0,
    upcomingSession: null,
    lastSession: null,
    programProgress: 0,
    isGrowOrExec: false,
    hasEndOfProgramScores: false,
    hasReflection: false,
    isPendingReflection: false,
    isScale: false,
    scaleCheckpointStatus: {
      isScaleUser: false,
      currentCheckpointNumber: 0,
      sessionsSinceLastCheckpoint: 0,
      nextCheckpointDueAtSession: 0,
      isCheckpointDue: false,
      checkpoints: [],
      latestCheckpoint: null,
    },
  };

  const actualCoachingState: CoachingStateData = employee
    ? getCoachingState(employee, sessions, baseline, competencyScores, reflection, checkpoints, welcomeSurveyScale, programType)
    : defaultCoachingState;

  // Effective program type (actual or overridden for admin preview)
  const effectiveProgramType = programTypeOverride || programType;

  // Mock data for admin preview states
  const mockCoachName = sessions[0]?.coach_name || 'Darcy Roberts';

  const mockUpcomingSession: Session = {
    id: 'preview-session-upcoming',
    employee_id: employee?.id || '',
    employee_email: employee?.company_email || '',
    employee_name: employee?.first_name || 'there',
    session_date: (() => {
      const date = new Date();
      date.setDate(date.getDate() + 7);
      date.setHours(14, 0, 0, 0);
      return date.toISOString();
    })(),
    status: 'Upcoming',
    coach_name: mockCoachName,
    leadership_management_skills: null,
    communication_skills: null,
    mental_well_being: null,
    other_themes: null,
    summary: null,
    goals: null,
    plan: null,
    duration_minutes: null,
    company_id: null,
    account_name: null,
    program_name: 'GROW',
    program_title: null,
    appointment_number: 'SA-000007',
    created_at: new Date().toISOString(),
    zoom_join_link: 'https://zoom.us/j/123456789',
    employee_pre_session_note: null,
    employee_notes: null,
  };

  const mockCompletedSessions: Session[] = Array.from({ length: 6 }, (_, i) => ({
    id: `preview-session-${i + 1}`,
    employee_id: employee?.id || '',
    employee_email: employee?.company_email || '',
    employee_name: employee?.first_name || 'there',
    session_date: (() => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i) * 14);
      date.setHours(14, 0, 0, 0);
      return date.toISOString();
    })(),
    status: 'Completed' as const,
    coach_name: mockCoachName,
    leadership_management_skills: i >= 3 ? 'Leading through change' : null,
    communication_skills: i >= 2 ? 'Giving constructive feedback' : null,
    mental_well_being: i >= 4 ? 'Managing stress' : null,
    other_themes: null,
    summary: i === 5 ? 'Great progress on reframing feedback as a gift. Next session we\'ll work on handling defensive reactions.' : null,
    goals: i === 5 ? 'Practice delivering constructive feedback to direct reports while maintaining psychological safety.' : null,
    plan: i === 5 ? 'Focus on separating observation from judgment when giving feedback. Practice the SBI model with your next direct report check-in.' : null,
    duration_minutes: 45,
    company_id: null,
    account_name: null,
    program_name: 'GROW',
    program_title: null,
    appointment_number: `SA-00000${i + 1}`,
    created_at: new Date().toISOString(),
    zoom_join_link: null,
    employee_pre_session_note: null,
    employee_notes: null,
  }));

  const mockBaseline: BaselineSurvey = {
    id: 'preview-baseline-1',
    email: employee?.company_email || '',
    created_at: new Date().toISOString(),
    coaching_goals: "I want to get better at giving direct feedback without damaging relationships, and develop more confidence in high-stakes conversations.",
    satisfaction: 4,
    productivity: 3,
    work_life_balance: 3,
    motivation: 4,
    comp_adaptability_and_resilience: 3,
    comp_building_relationships_at_work: 4,
    comp_change_management: 2,
    comp_delegation_and_accountability: 3,
    comp_effective_communication: 4,
    comp_effective_planning_and_execution: 3,
    comp_emotional_intelligence: 4,
    comp_giving_and_receiving_feedback: 2,
    comp_persuasion_and_influence: 3,
    comp_self_confidence_and_imposter_syndrome: 2,
    comp_strategic_thinking: 3,
    comp_time_management_and_productivity: 4,
  };

  // ARCHITECTURE NOTE: Two session arrays serve different purposes.
  // - `sessions` (full history): used by getCoachingState() for state detection, Progress for metrics
  // - `recentSessions` (90 days): used by display components for goals, plans, summaries
  // Coaches were asked to review the last 90 days only. Do NOT pass raw `sessions` to display components.
  const recentSessions = sessions.filter(s => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    return new Date(s.session_date) >= ninetyDaysAgo;
  });

  const isPreviewingPreFirstSession = stateOverride === 'MATCHED_PRE_FIRST_SESSION';
  const isPreviewingActiveProgram = stateOverride === 'ACTIVE_PROGRAM';

  let effectiveSessions = recentSessions;
  if (isPreviewingPreFirstSession) {
    effectiveSessions = [{ ...mockUpcomingSession, appointment_number: 'SA-000001' }];
  } else if (isPreviewingActiveProgram) {
    effectiveSessions = [...mockCompletedSessions, mockUpcomingSession];
  }

  const effectiveBaseline = (isPreviewingPreFirstSession || isPreviewingActiveProgram) ? mockBaseline : baseline;

  const mockActionItems: ActionItem[] = isPreviewingActiveProgram ? [
    {
      id: 'mock-action-1',
      email: employee?.company_email || '',
      session_id: 6,
      coach_name: mockCoachName,
      action_text: 'Practice the SBI model in your next 1:1 with a direct report',
      due_date: null,
      status: 'pending',
      employee_note: null,
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      completed_at: null,
    },
    {
      id: 'mock-action-2',
      email: employee?.company_email || '',
      session_id: 5,
      coach_name: mockCoachName,
      action_text: 'Journal about a recent difficult feedback conversation and what you would do differently',
      due_date: null,
      status: 'pending',
      employee_note: null,
      created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      completed_at: null,
    },
    {
      id: 'mock-action-3',
      email: employee?.company_email || '',
      session_id: 4,
      coach_name: mockCoachName,
      action_text: 'Schedule a skip-level meeting with someone on your team',
      due_date: null,
      status: 'pending',
      employee_note: null,
      created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
      completed_at: null,
    },
  ] : [];

  const effectiveActionItems = isPreviewingActiveProgram ? mockActionItems : actionItems;

  // Apply state override if set (for admin preview)
  const coachingState: CoachingStateData = (stateOverride || programTypeOverride)
    ? {
        ...actualCoachingState,
        state: stateOverride || actualCoachingState.state,
        isPendingReflection: stateOverride === 'PENDING_REFLECTION',
        hasReflection: stateOverride === 'COMPLETED_PROGRAM',
        isScale: effectiveProgramType === 'SCALE',
        isGrowOrExec: effectiveProgramType === 'GROW' || effectiveProgramType === 'EXEC',
        scaleCheckpointStatus: effectiveProgramType === 'SCALE'
          ? {
              ...actualCoachingState.scaleCheckpointStatus,
              isScaleUser: true,
              isCheckpointDue: actualCoachingState.completedSessionCount >= 6 && checkpoints.length === 0,
            }
          : {
              isScaleUser: false,
              currentCheckpointNumber: 0,
              sessionsSinceLastCheckpoint: 0,
              nextCheckpointDueAtSession: 0,
              isCheckpointDue: false,
              checkpoints: [],
              latestCheckpoint: null,
            },
      }
    : actualCoachingState;

  const retryLoadData = () => setRetryCount(c => c + 1);

  return {
    loading,
    employee,
    dataLoading,
    dataError,
    retryLoadData,
    sessions,
    recentSessions,
    effectiveSessions,
    progress,
    baseline,
    effectiveBaseline,
    welcomeSurveyScale,
    competencyScores,
    programType,
    effectiveProgramType,
    actionItems,
    effectiveActionItems,
    reflection,
    checkpoints,
    coachingWins,
    welcomeSurveyLink,
    actualCoachingState,
    coachingState,
    pendingSurvey,
    showSurveyModal,
    showReflectionFlow,
    showCheckpointFlow,
    stateOverride,
    programTypeOverride,
    reloadActionItems,
    handleStartReflection,
    handleStartCheckpoint,
    handleReflectionComplete,
    handleCheckpointComplete,
    handleSurveyComplete,
    handleAddWin,
    handleDeleteWin,
    handleUpdateWin,
    setShowReflectionFlow,
    setShowCheckpointFlow,
    setShowSurveyModal,
    setStateOverride,
    setProgramTypeOverride,
    setReflection,
    setCheckpoints,
  };
}
