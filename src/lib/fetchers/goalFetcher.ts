import { supabase } from '../supabase';
import type {
  Goal,
  WeeklyCommitment,
  GoalCheckin,
  GoalStatus,
  CommitmentStatus,
  CheckinType,
  FocusAreaSelection,
} from '../types';

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};

export async function fetchGoals(email: string): Promise<Goal[]> {
  devLog('[fetchGoals] Fetching goals for:', email);

  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .ilike('employee_email', email)
    .in('status', ['active', 'completed'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching goals:', error);
    return [];
  }

  devLog('[fetchGoals] Found:', data?.length || 0);
  return (data || []) as Goal[];
}

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
    // Last 8 weeks
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

export async function fetchFocusAreas(email: string): Promise<FocusAreaSelection[]> {
  devLog('[fetchFocusAreas] Fetching for:', email);

  const { data, error } = await supabase
    .from('focus_area_selections')
    .select('*')
    .ilike('email', email)
    .eq('selected', true);

  if (error) {
    console.error('Error fetching focus areas:', error);
    return [];
  }

  devLog('[fetchFocusAreas] Found:', data?.length || 0);
  return (data || []) as FocusAreaSelection[];
}

export async function createGoal(goal: {
  employee_email: string;
  company_id: string;
  title: string;
  description?: string;
  competency_area?: string;
}): Promise<Goal | null> {
  devLog('[createGoal] Creating:', goal.title);

  const { data, error } = await supabase
    .from('goals')
    .insert({
      employee_email: goal.employee_email,
      company_id: goal.company_id,
      title: goal.title,
      description: goal.description || null,
      competency_area: goal.competency_area || null,
      status: 'active' as GoalStatus,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating goal:', error);
    return null;
  }

  devLog('[createGoal] Created:', data?.id);
  return data as Goal;
}

export async function updateGoal(
  goalId: string,
  updates: {
    title?: string;
    description?: string;
    status?: GoalStatus;
    completed_at?: string;
  }
): Promise<boolean> {
  devLog('[updateGoal] Updating:', goalId, updates);

  const { error } = await supabase
    .from('goals')
    .update(updates)
    .eq('id', goalId);

  if (error) {
    console.error('Error updating goal:', error);
    return false;
  }

  devLog('[updateGoal] Success');
  return true;
}

export async function createWeeklyCommitment(commitment: {
  employee_email: string;
  company_id: string;
  goal_id: string;
  commitment_text: string;
  week_start: string;
}): Promise<WeeklyCommitment | null> {
  devLog('[createWeeklyCommitment] Creating for week:', commitment.week_start);

  const { data, error } = await supabase
    .from('weekly_commitments')
    .insert({
      employee_email: commitment.employee_email,
      company_id: commitment.company_id,
      goal_id: commitment.goal_id,
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

  devLog('[updateCommitmentStatus] Success');
  return true;
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

export async function seedGoalsFromFocusAreas(
  email: string,
  companyId: string
): Promise<Goal[]> {
  devLog('[seedGoalsFromFocusAreas] Checking existing goals for:', email);

  const existingGoals = await fetchGoals(email);
  if (existingGoals.length > 0) {
    devLog('[seedGoalsFromFocusAreas] Goals already exist, returning:', existingGoals.length);
    return existingGoals;
  }

  const focusAreas = await fetchFocusAreas(email);
  if (focusAreas.length === 0) {
    devLog('[seedGoalsFromFocusAreas] No focus areas selected');
    return [];
  }

  devLog('[seedGoalsFromFocusAreas] Seeding from', focusAreas.length, 'focus areas');

  const createdGoals: Goal[] = [];
  for (const area of focusAreas) {
    const goal = await createGoal({
      employee_email: email,
      company_id: companyId,
      title: area.focus_area_name,
      competency_area: area.focus_area_name,
    });
    if (goal) {
      createdGoals.push(goal);
    }
  }

  devLog('[seedGoalsFromFocusAreas] Created:', createdGoals.length, 'goals');
  return createdGoals;
}

export async function fetchActionItemsForGoal(goalId: string): Promise<{
  id: string;
  action_text: string;
  status: string;
  created_at: string;
}[]> {
  devLog('[fetchActionItemsForGoal] Fetching for goal:', goalId);

  const { data, error } = await supabase
    .from('action_items')
    .select('id, action_text, status, created_at')
    .eq('goal_id', goalId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching action items for goal:', error);
    return [];
  }

  return data || [];
}

export function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  // Subtract days to get to Monday (day 0 = Sunday, so Monday = 1)
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
  devLog('[getCurrentWeekCommitmentStatus] Week start:', weekStart, 'for:', email);

  const commitments = await fetchWeeklyCommitments(email, weekStart);
  const commitment = commitments.length > 0 ? commitments[0] : null;

  if (!commitment) {
    return {
      hasCommitment: false,
      hasMidweekCheckin: false,
      hasEndweekCheckin: false,
      commitment: null,
    };
  }

  const checkins = await fetchGoalCheckins(email, [commitment.id]);

  return {
    hasCommitment: true,
    hasMidweekCheckin: checkins.some((c) => c.checkin_type === 'midweek'),
    hasEndweekCheckin: checkins.some((c) => c.checkin_type === 'endweek'),
    commitment,
  };
}
