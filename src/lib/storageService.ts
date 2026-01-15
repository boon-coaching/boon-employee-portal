// Local storage service for Practice feature

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  context: string;
  createdAt: string;
}

export interface SavedPlan {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  context: string;
  teamMemberId?: string;
  teamMemberName?: string;
  plan: string;
  createdAt: string;
}

const TEAM_STORAGE_KEY = 'boon_practice_team';
const PLAYBOOK_STORAGE_KEY = 'boon_practice_playbook';

// ============================================
// TEAM MEMBERS
// ============================================

export function getTeamMembers(): TeamMember[] {
  try {
    const stored = localStorage.getItem(TEAM_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveTeamMember(member: Omit<TeamMember, 'id' | 'createdAt'>): TeamMember {
  const members = getTeamMembers();
  const newMember: TeamMember = {
    ...member,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  members.push(newMember);
  localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(members));
  return newMember;
}

export function updateTeamMember(id: string, updates: Partial<Omit<TeamMember, 'id' | 'createdAt'>>): TeamMember | null {
  const members = getTeamMembers();
  const index = members.findIndex(m => m.id === id);
  if (index === -1) return null;

  members[index] = { ...members[index], ...updates };
  localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(members));
  return members[index];
}

export function deleteTeamMember(id: string): boolean {
  const members = getTeamMembers();
  const filtered = members.filter(m => m.id !== id);
  if (filtered.length === members.length) return false;

  localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

// ============================================
// PLAYBOOK (SAVED PLANS)
// ============================================

export function getSavedPlans(): SavedPlan[] {
  try {
    const stored = localStorage.getItem(PLAYBOOK_STORAGE_KEY);
    const plans = stored ? JSON.parse(stored) : [];
    // Sort by most recent first
    return plans.sort((a: SavedPlan, b: SavedPlan) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

export function savePlan(plan: Omit<SavedPlan, 'id' | 'createdAt'>): SavedPlan {
  const plans = getSavedPlans();
  const newPlan: SavedPlan = {
    ...plan,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  plans.unshift(newPlan); // Add to beginning
  localStorage.setItem(PLAYBOOK_STORAGE_KEY, JSON.stringify(plans));
  return newPlan;
}

export function deleteSavedPlan(id: string): boolean {
  const plans = getSavedPlans();
  const filtered = plans.filter(p => p.id !== id);
  if (filtered.length === plans.length) return false;

  localStorage.setItem(PLAYBOOK_STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

export function getPlanById(id: string): SavedPlan | null {
  const plans = getSavedPlans();
  return plans.find(p => p.id === id) || null;
}
