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
