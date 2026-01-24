// Storage service for Practice feature - using Supabase for persistence
import { supabase } from './supabase';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  context: string;
  created_at: string;
}

export interface SavedPlan {
  id: string;
  scenario_id: string;
  scenario_title: string;
  context: string;
  team_member_id?: string;
  team_member_name?: string;
  plan: string;
  created_at: string;
}

export interface PracticeEvaluation {
  id: string;
  employee_email: string;
  scenario_id: string;
  scenario_title: string;
  score: number | null;
  feedback: string | null;
  strengths: string[] | null;
  areas_to_improve: string[] | null;
  conversation: Array<{ role: 'user' | 'model'; text: string }> | null;
  created_at: string;
}

// ============================================
// TEAM MEMBERS
// ============================================

export async function getTeamMembers(email: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('practice_team_members')
    .select('id, name, role, context, created_at')
    .eq('employee_email', email.toLowerCase())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching team members:', error);
    return [];
  }

  return data || [];
}

export async function saveTeamMember(
  email: string,
  member: { name: string; role: string; context: string }
): Promise<TeamMember | null> {
  const { data, error } = await supabase
    .from('practice_team_members')
    .insert({
      employee_email: email.toLowerCase(),
      name: member.name,
      role: member.role,
      context: member.context,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving team member:', error);
    return null;
  }

  return data;
}

export async function updateTeamMember(
  id: string,
  updates: { name?: string; role?: string; context?: string }
): Promise<TeamMember | null> {
  const { data, error } = await supabase
    .from('practice_team_members')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating team member:', error);
    return null;
  }

  return data;
}

export async function deleteTeamMember(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('practice_team_members')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting team member:', error);
    return false;
  }

  return true;
}

// ============================================
// PLAYBOOK (SAVED PLANS)
// ============================================

export async function getSavedPlans(email: string): Promise<SavedPlan[]> {
  const { data, error } = await supabase
    .from('practice_saved_plans')
    .select('id, scenario_id, scenario_title, context, team_member_id, team_member_name, plan, created_at')
    .eq('employee_email', email.toLowerCase())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching saved plans:', error);
    return [];
  }

  return data || [];
}

export async function savePlan(
  email: string,
  plan: {
    scenario_id: string;
    scenario_title: string;
    context: string;
    team_member_id?: string;
    team_member_name?: string;
    plan: string;
  }
): Promise<SavedPlan | null> {
  const { data, error } = await supabase
    .from('practice_saved_plans')
    .insert({
      employee_email: email.toLowerCase(),
      scenario_id: plan.scenario_id,
      scenario_title: plan.scenario_title,
      context: plan.context,
      team_member_id: plan.team_member_id,
      team_member_name: plan.team_member_name,
      plan: plan.plan,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving plan:', error);
    return null;
  }

  return data;
}

export async function deleteSavedPlan(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('practice_saved_plans')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting plan:', error);
    return false;
  }

  return true;
}

export async function getPlanById(id: string): Promise<SavedPlan | null> {
  const { data, error } = await supabase
    .from('practice_saved_plans')
    .select('id, scenario_id, scenario_title, context, team_member_id, team_member_name, plan, created_at')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching plan:', error);
    return null;
  }

  return data;
}

// ============================================
// PRACTICE EVALUATIONS (Learning/Memory)
// ============================================

/**
 * Parse score from evaluation text (format: "**Adherence Score: X/5**")
 */
function parseScoreFromEvaluation(evaluation: string): number | null {
  const match = evaluation.match(/\*?\*?Adherence Score:\s*(\d)\/5\*?\*?/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parse strengths from evaluation text
 */
function parseStrengthsFromEvaluation(evaluation: string): string[] {
  const strengthsSection = evaluation.match(/\*?\*?What Went Well:?\*?\*?\s*([\s\S]*?)(?=\*?\*?What Was Missing|$)/i);
  if (!strengthsSection) return [];

  const lines = strengthsSection[1]
    .split('\n')
    .map(l => l.replace(/^[-*•]\s*/, '').trim())
    .filter(l => l.length > 0 && l.length < 200);

  return lines.slice(0, 5);
}

/**
 * Parse areas to improve from evaluation text
 */
function parseAreasToImproveFromEvaluation(evaluation: string): string[] {
  const areasSection = evaluation.match(/\*?\*?What Was Missing or Weak:?\*?\*?\s*([\s\S]*?)(?=\*?\*?Better Approach|$)/i);
  if (!areasSection) return [];

  const lines = areasSection[1]
    .split('\n')
    .map(l => l.replace(/^[-*•]\s*/, '').trim())
    .filter(l => l.length > 0 && l.length < 200);

  return lines.slice(0, 5);
}

/**
 * Save a practice evaluation
 */
export async function saveEvaluation(
  email: string,
  evaluation: {
    scenario_id: string;
    scenario_title: string;
    feedback: string;
    conversation: Array<{ role: 'user' | 'model'; text: string }>;
  }
): Promise<PracticeEvaluation | null> {
  const score = parseScoreFromEvaluation(evaluation.feedback);
  const strengths = parseStrengthsFromEvaluation(evaluation.feedback);
  const areasToImprove = parseAreasToImproveFromEvaluation(evaluation.feedback);

  const { data, error } = await supabase
    .from('practice_evaluations')
    .insert({
      employee_email: email.toLowerCase(),
      scenario_id: evaluation.scenario_id,
      scenario_title: evaluation.scenario_title,
      score,
      feedback: evaluation.feedback,
      strengths,
      areas_to_improve: areasToImprove,
      conversation: evaluation.conversation,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving evaluation:', error);
    return null;
  }

  return data;
}

/**
 * Get recent evaluations for a user (for AI context)
 */
export async function getRecentEvaluations(
  email: string,
  limit: number = 5
): Promise<PracticeEvaluation[]> {
  const { data, error } = await supabase
    .from('practice_evaluations')
    .select('*')
    .eq('employee_email', email.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching evaluations:', error);
    return [];
  }

  return data || [];
}

/**
 * Get evaluations for a specific scenario
 */
export async function getEvaluationsForScenario(
  email: string,
  scenarioId: string,
  limit: number = 3
): Promise<PracticeEvaluation[]> {
  const { data, error } = await supabase
    .from('practice_evaluations')
    .select('*')
    .eq('employee_email', email.toLowerCase())
    .eq('scenario_id', scenarioId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching scenario evaluations:', error);
    return [];
  }

  return data || [];
}

/**
 * Get a summary of user's practice history for AI context
 */
export async function getPracticeHistorySummary(email: string): Promise<{
  totalSessions: number;
  averageScore: number | null;
  recentScenarios: Array<{ title: string; score: number | null; date: string }>;
  commonStrengths: string[];
  commonAreasToImprove: string[];
} | null> {
  const evaluations = await getRecentEvaluations(email, 10);

  if (evaluations.length === 0) return null;

  const scores = evaluations.map(e => e.score).filter((s): s is number => s !== null);
  const averageScore = scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null;

  // Aggregate strengths and areas to improve
  const allStrengths = evaluations.flatMap(e => e.strengths || []);
  const allAreas = evaluations.flatMap(e => e.areas_to_improve || []);

  // Count occurrences and get top items
  const countOccurrences = (arr: string[]): string[] => {
    const counts = arr.reduce((acc, item) => {
      const key = item.toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key]) => arr.find(s => s.toLowerCase() === key) || key);
  };

  return {
    totalSessions: evaluations.length,
    averageScore,
    recentScenarios: evaluations.slice(0, 5).map(e => ({
      title: e.scenario_title,
      score: e.score,
      date: e.created_at,
    })),
    commonStrengths: countOccurrences(allStrengths),
    commonAreasToImprove: countOccurrences(allAreas),
  };
}
