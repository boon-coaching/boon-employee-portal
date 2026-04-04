import { supabase } from '../supabase';
import type {
  Session,
  ActionItem,
  WeeklyCommitment,
  GoalCheckin,
  CommitmentStatus,
  CheckinType,
} from '../types';

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};

// ============================================
// SESSION-ANCHORED GOAL DATA
// ============================================

export interface CoachingGoal {
  goals: string;
  plan: string | null;
  session_date: string;
  coach_name: string;
  session_id: string;
}

/**
 * Get the current coaching goal from the most recent session that has goals set.
 * This is the coach-set goal that anchors the accountability system.
 */
export function getLatestCoachingGoal(sessions: Session[]): CoachingGoal | null {
  const completed = sessions
    .filter(s => s.status === 'Completed' && s.goals)
    .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

  if (completed.length === 0) return null;

  const session = completed[0];
  return {
    goals: session.goals!,
    plan: session.plan,
    session_date: session.session_date,
    coach_name: session.coach_name,
    session_id: session.id,
  };
}

/**
 * Get the history of coaching goals across sessions (how goals evolved over time).
 */
export function getGoalHistory(sessions: Session[]): CoachingGoal[] {
  return sessions
    .filter(s => s.status === 'Completed' && s.goals)
    .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
    .map(s => ({
      goals: s.goals!,
      plan: s.plan,
      session_date: s.session_date,
      coach_name: s.coach_name,
      session_id: s.id,
    }));
}

/**
 * Get pending action items for the employee (from the action_items table).
 * These are coach-prescribed steps, not self-created.
 */
export function getPendingActionItems(actionItems: ActionItem[]): ActionItem[] {
  return actionItems
    .filter(a => a.status === 'pending')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// ============================================
// WEEKLY COMMITMENTS (employee-set, anchored to coaching goal)
// ============================================

export async function fetchWeeklyCommitments(
  email: string,
  weekStart?: string
): Promise<WeeklyCommitment[]> {
  devLog('[fetchWeeklyCommitments] Fetching for:', { email, weekStart });

  let query = supabase
    .from('weekly_commitments')
    .select('*')
    .ilike('employee_email', email);

  if (weekStart) {
    query = query.eq('week_start', weekStart);
  } else {
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
    query = query.gte('week_start', eightWeeksAgo.toISOString().split('T')[0]);
  }

  const { data, error } = await query.order('week_start', { ascending: false });

  if (error) {
    console.error('Error fetching weekly commitments:', error);
    return [];
  }

  devLog('[fetchWeeklyCommitments] Found:', data?.length || 0);
  return (data || []) as WeeklyCommitment[];
}

export async function createWeeklyCommitment(commitment: {
  employee_email: string;
  company_id: string;
  goal_id?: string;
  commitment_text: string;
  week_start: string;
}): Promise<WeeklyCommitment | null> {
  devLog('[createWeeklyCommitment] Creating for week:', commitment.week_start);

  const { data, error } = await supabase
    .from('weekly_commitments')
    .insert({
      employee_email: commitment.employee_email,
      company_id: commitment.company_id,
      goal_id: commitment.goal_id || null,
      commitment_text: commitment.commitment_text,
      week_start: commitment.week_start,
      status: 'active' as CommitmentStatus,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating weekly commitment:', error);
    return null;
  }

  devLog('[createWeeklyCommitment] Created:', data?.id);
  return data as WeeklyCommitment;
}

export async function updateCommitmentStatus(
  commitmentId: string,
  status: CommitmentStatus,
  reflectionText?: string
): Promise<boolean> {
  devLog('[updateCommitmentStatus] Updating:', commitmentId, status);

  const updates: Record<string, unknown> = { status };
  if (reflectionText !== undefined) {
    updates.reflection_text = reflectionText;
  }

  const { error } = await supabase
    .from('weekly_commitments')
    .update(updates)
    .eq('id', commitmentId);

  if (error) {
    console.error('Error updating commitment status:', error);
    return false;
  }

  return true;
}

// ============================================
// CHECK-INS
// ============================================

export async function fetchGoalCheckins(
  email: string,
  commitmentIds?: string[]
): Promise<GoalCheckin[]> {
  devLog('[fetchGoalCheckins] Fetching for:', { email, commitmentIds });

  let query = supabase
    .from('goal_checkins')
    .select('*')
    .ilike('employee_email', email);

  if (commitmentIds && commitmentIds.length > 0) {
    query = query.in('commitment_id', commitmentIds);
  } else {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    query = query.gte('created_at', thirtyDaysAgo.toISOString());
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching goal checkins:', error);
    return [];
  }

  devLog('[fetchGoalCheckins] Found:', data?.length || 0);
  return (data || []) as GoalCheckin[];
}

export async function createGoalCheckin(checkin: {
  employee_email: string;
  company_id: string;
  commitment_id: string;
  checkin_type: CheckinType;
  progress_rating: number;
  reflection_text?: string;
  blockers?: string;
}): Promise<GoalCheckin | null> {
  devLog('[createGoalCheckin] Creating:', checkin.checkin_type);

  const { data, error } = await supabase
    .from('goal_checkins')
    .insert({
      employee_email: checkin.employee_email,
      company_id: checkin.company_id,
      commitment_id: checkin.commitment_id,
      checkin_type: checkin.checkin_type,
      progress_rating: checkin.progress_rating,
      reflection_text: checkin.reflection_text || null,
      blockers: checkin.blockers || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating goal checkin:', error);
    return null;
  }

  devLog('[createGoalCheckin] Created:', data?.id);
  return data as GoalCheckin;
}

// ============================================
// GOAL REFLECTION & SELF-PROGRESS
// ============================================

export async function fetchGoalReflection(email: string): Promise<{
  reflection: string | null;
  selfProgress: string | null;
} | null> {
  const { data, error } = await supabase
    .from('goals')
    .select('description, self_progress')
    .ilike('employee_email', email)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return { reflection: data.description, selfProgress: data.self_progress };
}

export async function upsertGoalReflection(params: {
  email: string;
  companyId: string;
  goalText: string;
  reflection?: string;
  selfProgress?: string;
}): Promise<boolean> {
  // Check if a goal record exists for this employee
  const { data: existing } = await supabase
    .from('goals')
    .select('id')
    .ilike('employee_email', params.email)
    .eq('status', 'active')
    .limit(1)
    .single();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.reflection !== undefined) updates.description = params.reflection;
  if (params.selfProgress !== undefined) updates.self_progress = params.selfProgress;

  if (existing) {
    const { error } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', existing.id);
    return !error;
  } else {
    const { error } = await supabase
      .from('goals')
      .insert({
        employee_email: params.email,
        company_id: params.companyId,
        title: params.goalText,
        description: params.reflection || null,
        self_progress: params.selfProgress || 'not_started',
        status: 'active',
      });
    return !error;
  }
}

// ============================================
// HELPERS
// ============================================

export function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function getCurrentWeekCommitmentStatus(email: string): Promise<{
  hasCommitment: boolean;
  hasMidweekCheckin: boolean;
  hasEndweekCheckin: boolean;
  commitment: WeeklyCommitment | null;
}> {
  const weekStart = getWeekStart();
  devLog('[getCurrentWeekCommitmentStatus] Week start:', weekStart);

  const commitments = await fetchWeeklyCommitments(email, weekStart);
  const commitment = commitments.length > 0 ? commitments[0] : null;

  if (!commitment) {
    return { hasCommitment: false, hasMidweekCheckin: false, hasEndweekCheckin: false, commitment: null };
  }

  const checkins = await fetchGoalCheckins(email, [commitment.id]);

  return {
    hasCommitment: true,
    hasMidweekCheckin: checkins.some(c => c.checkin_type === 'midweek'),
    hasEndweekCheckin: checkins.some(c => c.checkin_type === 'endweek'),
    commitment,
  };
}
