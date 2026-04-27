import { supabase } from './supabase';
import type { Employee, Session, SurveyResponse, BaselineSurvey, WelcomeSurveyScale, CompetencyScore, ProgramType, ActionItem, SlackConnectionStatus, TeamsConnectionStatus, Nudge, ReflectionResponse, Checkpoint, Coach } from './types';

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};

/**
 * Fetch employee profile by email
 */
export async function fetchEmployeeProfile(email: string): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('employee_manager')
    .select('*')
    .ilike('company_email', email)
    .single();

  if (error) {
    console.error('Error fetching employee profile:', error);
    return null;
  }

  return data as Employee;
}

// Fetches sessions for an employee by session_tracking.employee_id.
// (Previously attempted email/RPC fallbacks against columns that don't exist.)
export async function fetchSessions(employeeId: string): Promise<Session[]> {
  devLog('[fetchSessions] Starting lookup for:', { employeeId });

  const { data, error } = await supabase
    .from('session_tracking')
    .select('*')
    .eq('employee_id', employeeId)
    .order('session_date', { ascending: false });

  devLog('[fetchSessions] By employee_id:', {
    found: data?.length || 0,
    error: error?.message || 'none',
  });

  if (error || !data) {
    return [];
  }

  // Dedupe by id — `session_tracking` is supposed to be unique on id but the
  // legacy SF sync has produced occasional duplicates.
  const seen = new Set<string>();
  return (data as Session[]).filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

/**
 * Fetch survey responses (progress data) for an employee
 */
export async function fetchProgressData(email: string): Promise<SurveyResponse[]> {
  const { data, error } = await supabase
    .from('survey_submissions')
    .select('*')
    .ilike('email', email)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching progress data:', error);
    return [];
  }

  return (data as SurveyResponse[]) || [];
}

/**
 * Fetch baseline survey from welcome_survey_baseline table
 * Contains both wellbeing metrics and competency baselines
 */
export async function fetchBaseline(email: string): Promise<BaselineSurvey | null> {
  devLog('[fetchBaseline] Looking up for email:', email);

  const { data, error } = await supabase
    .from('welcome_survey_baseline')
    .select('*')
    .ilike('email', email)
    .order('id', { ascending: false })
    .limit(1);

  devLog('[fetchBaseline] Result:', {
    found: data?.length || 0,
    error: error?.message,
    firstRecord: data?.[0] ? { id: data[0].id, email: data[0].email, program_type: data[0].program_type } : null
  });

  if (error) {
    console.error('Error fetching baseline:', error);
    return null;
  }

  return (data && data.length > 0) ? data[0] as BaselineSurvey : null;
}

/**
 * Fetch welcome survey for SCALE users
 * Contains coaching goals and focus area selections
 */
export async function fetchWelcomeSurveyScale(email: string): Promise<WelcomeSurveyScale | null> {
  devLog('[fetchWelcomeSurveyScale] Looking up for email:', email);

  const { data, error } = await supabase
    .from('welcome_survey_scale')
    .select('*')
    .ilike('email', email)
    .order('id', { ascending: false })
    .limit(1);

  devLog('[fetchWelcomeSurveyScale] Result:', {
    found: data?.length || 0,
    error: error?.message || 'none',
    errorCode: error?.code || 'none',
  });

  if (error) {
    // Table might not exist yet
    if (error.code !== '42P01' && error.code !== 'PGRST116') {
      console.error('Error fetching SCALE welcome survey:', error);
    }
    return null;
  }

  if (data && data.length > 0) {
    devLog('[fetchWelcomeSurveyScale] Found data:', {
      email: data[0].email,
      satisfaction: data[0].satisfaction,
      productivity: data[0].productivity,
      work_life_balance: data[0].work_life_balance,
    });
  }

  return (data && data.length > 0) ? data[0] as WelcomeSurveyScale : null;
}

/**
 * Fetch competency scores for a user (current/end-of-program scores)
 */
export async function fetchCompetencyScores(email: string): Promise<CompetencyScore[]> {
  const { data, error } = await supabase
    .from('competency_scores')
    .select('*')
    .ilike('email', email)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code !== 'PGRST116' && error.code !== '42P01') {
      console.error('Error fetching competency scores:', error);
    }
    return [];
  }

  return (data as CompetencyScore[]) || [];
}

/**
 * Fetch program type for an employee via their program field
 * The program field might contain a UUID, a program name, or the program type directly
 * Examples: "GROW", "GROW - Cohort 1", "TWC SLX Program 2025", UUID
 */
export async function fetchProgramType(programId: string | null): Promise<ProgramType | null> {
  devLog('[fetchProgramType] Input programId:', programId);

  if (!programId) {
    devLog('[fetchProgramType] No programId, returning null');
    return null;
  }

  const upperProgram = programId.toUpperCase();
  devLog('[fetchProgramType] Checking upperProgram:', upperProgram);

  // Check if it starts with a known program type (e.g., "GROW - Cohort 1")
  if (upperProgram === 'SCALE' || upperProgram.startsWith('SCALE ') || upperProgram.startsWith('SCALE-') || upperProgram.includes(' SCALE')) {
    devLog('[fetchProgramType] Matched SCALE pattern');
    return 'SCALE';
  }
  if (upperProgram === 'GROW' || upperProgram.startsWith('GROW ') || upperProgram.startsWith('GROW-') || upperProgram.includes(' GROW')) {
    devLog('[fetchProgramType] Matched GROW pattern');
    return 'GROW';
  }
  if (upperProgram === 'EXEC' || upperProgram.startsWith('EXEC ') || upperProgram.startsWith('EXEC-') || upperProgram.includes(' EXEC')) {
    devLog('[fetchProgramType] Matched EXEC pattern');
    return 'EXEC';
  }
  // Check for SLX which is SCALE
  if (upperProgram.includes('SLX')) {
    devLog('[fetchProgramType] Matched SLX -> SCALE');
    return 'SCALE';
  }

  // Try to look up by ID first (if it looks like a UUID)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(programId);

  if (isUuid) {
    const { data, error } = await supabase
      .from('programs')
      .select('program_type')
      .eq('id', programId)
      .single();

    if (!error && data?.program_type) {
      return data.program_type as ProgramType;
    }
  }

  // Try to look up by name/title
  const { data: byName, error: nameError } = await supabase
    .from('programs')
    .select('program_type')
    .ilike('name', `%${programId}%`)
    .limit(1)
    .single();

  if (!nameError && byName?.program_type) {
    return byName.program_type as ProgramType;
  }

  devLog('Could not determine program type for:', programId);
  return null;
}

/**
 * Fetch the latest survey response for progress comparison
 */
export async function fetchLatestSurveyResponse(email: string): Promise<SurveyResponse | null> {
  const { data, error } = await supabase
    .from('survey_submissions')
    .select('*')
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching latest survey:', error);
    }
    return null;
  }

  return data as SurveyResponse;
}

/**
 * Fetch action items for an employee
 */
export async function fetchActionItems(email: string): Promise<ActionItem[]> {
  devLog('[fetchActionItems] Fetching for email:', email);

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data, error } = await supabase
    .from('action_items')
    .select('*')
    .ilike('email', email)
    .gte('created_at', ninetyDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    devLog('[fetchActionItems] Error:', {
      errorCode: error.code,
      errorMessage: error.message,
      searchedEmail: email
    });
    // Table might not exist yet
    if (error.code !== '42P01') {
      console.error('Error fetching action items:', error);
    }
    return [];
  }

  devLog('[fetchActionItems] Found items:', {
    count: data?.length || 0,
    items: data
  });
  return (data as ActionItem[]) || [];
}

/**
 * Update action item status
 */
export async function updateActionItemStatus(
  itemId: string,
  status: 'pending' | 'completed' | 'dismissed'
): Promise<boolean> {
  const { error } = await supabase
    .from('action_items')
    .update({
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    })
    .eq('id', itemId);

  if (error) {
    console.error('Error updating action item:', error);
    return false;
  }

  return true;
}

/**
 * Submit session feedback
 */
export async function submitSessionFeedback(
  sessionId: string,
  rating: number,
  feedback: string
): Promise<boolean> {
  // This could insert into a feedback table or update the session record
  const { error } = await supabase
    .from('session_feedback')
    .insert({
      session_id: sessionId,
      rating,
      feedback,
      created_at: new Date().toISOString(),
    });

  if (error) {
    // Table might not exist, log but don't fail
    console.error('Error submitting feedback:', error);
    return false;
  }

  return true;
}

/**
 * Public column allow-list for the coaches table.
 *
 * The DB GRANT (see 20260427_coaches_column_lockdown_v2.sql) restricts
 * authenticated/anon SELECT to non-PII columns. Querying `*` returns 403.
 * This constant mirrors the GRANT so portal queries succeed.
 *
 * Sensitive columns intentionally absent: phone, birthdate, mailing_address,
 * gender, race, linkedin, session_rate, account_name, companies, capacity
 * planning, performance metrics, HR data, infra. Service role / admin
 * edge functions bypass GRANTs and can still read those.
 */
const COACH_PUBLIC_COLUMNS = [
  'id',
  'salesforce_contact_id',
  'name',
  'first_name',
  'last_name',
  'email',
  'photo_url',
  'bio',
  'headline',
  'notable_credentials',
  'specialties',
  'industries',
  'services',
  'special_services',
  'coach_languages',
  'coach_department',
  'experienced_working_with',
  'improvement_areas',
  'pronouns',
  'age_range',
  'practitioner_type',
  'timezone',
  'preferred_time_window',
  'icf_level',
  'is_scale_coach',
  'is_grow_coach',
  'is_exec_coach',
  'is_active',
  'facilitator',
  'x360_performance',
  'assessments',
  'created_at',
  'updated_at',
].join(',');

/**
 * Fetch coach details by name
 * Tries direct query first, then RPC function to bypass RLS
 */
export async function fetchCoachByName(coachName: string): Promise<Coach | null> {
  const trimmedName = coachName.trim();
  devLog('[fetchCoachByName] Searching for coach:', trimmedName);

  // First try exact ilike match. Coaches table has duplicate rows for some
  // names (e.g. Sharon Wilson, Karen Patricelli), so .single() throws 406.
  // Order by photo_url DESC NULLS LAST so the row with a real headshot wins.
  const { data: exactData, error: exactError } = await supabase
    .from('coaches')
    .select(COACH_PUBLIC_COLUMNS)
    .ilike('name', trimmedName)
    .order('photo_url', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!exactError && exactData) {
    const coach = exactData as unknown as Coach;
    devLog('[fetchCoachByName] Found coach (exact match):', {
      name: coach.name,
      hasPhotoUrl: !!coach.photo_url,
      photoUrl: coach.photo_url
    });
    return coach;
  }

  // Try flexible match with wildcards (handles extra spaces, etc.)
  const { data: flexData, error: flexError } = await supabase
    .from('coaches')
    .select(COACH_PUBLIC_COLUMNS)
    .ilike('name', `%${trimmedName}%`)
    .order('photo_url', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!flexError && flexData) {
    const coach = flexData as unknown as Coach;
    devLog('[fetchCoachByName] Found coach (flexible match):', {
      searchedName: trimmedName,
      foundName: coach.name,
      hasPhotoUrl: !!coach.photo_url,
      photoUrl: coach.photo_url
    });
    return coach;
  }

  // Try matching by first name + last name separately (handles formatting differences)
  const nameParts = trimmedName.split(/\s+/).filter(Boolean);
  if (nameParts.length >= 2) {
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];

    const { data: partsData, error: partsError } = await supabase
      .from('coaches')
      .select(COACH_PUBLIC_COLUMNS)
      .ilike('name', `${firstName}%${lastName}`)
      .order('photo_url', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (!partsError && partsData) {
      const coach = partsData as unknown as Coach;
      devLog('[fetchCoachByName] Found coach (name parts match):', {
        searchedName: trimmedName,
        foundName: coach.name,
        hasPhotoUrl: !!coach.photo_url,
        photoUrl: coach.photo_url
      });
      return coach;
    }
  }

  // Fallback: Try RPC function which uses SECURITY DEFINER to bypass RLS
  devLog('[fetchCoachByName] Direct queries failed, trying RPC function');
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_coach_by_name', { coach_name_param: trimmedName });

  // RPC returns JSONB (single object), not an array
  if (!rpcError && rpcData) {
    devLog('[fetchCoachByName] Found coach via RPC:', {
      name: rpcData?.name,
      hasPhotoUrl: !!rpcData?.photo_url,
      photoUrl: rpcData?.photo_url
    });
    return rpcData as Coach;
  }

  devLog('[fetchCoachByName] No coach found for:', {
    searchedName: trimmedName,
    exactError: exactError?.message,
    flexError: flexError?.message,
    rpcError: rpcError?.message
  });
  return null;
}

/**
 * Fetch coach details by ID
 * Tries direct query first, then RPC function to bypass RLS
 */
/**
 * Fetch coach by Salesforce Contact Id (the value mirrored into
 * employee_manager.coach from SF Contact.Coach__c). Handles both 15-char
 * and 18-char SF id formats by matching the leading 15 characters.
 */
export async function fetchCoachBySfId(sfContactId: string): Promise<Coach | null> {
  if (!sfContactId) return null;
  const trimmed = sfContactId.trim();
  const id15 = trimmed.length >= 15 ? trimmed.slice(0, 15) : trimmed;
  const { data, error } = await supabase
    .from('coaches')
    .select(COACH_PUBLIC_COLUMNS)
    .ilike('salesforce_contact_id', `${id15}%`)
    .order('photo_url', { ascending: false, nullsFirst: false })
    .limit(1);
  if (!error && data && data.length > 0) return data[0] as unknown as Coach;
  return null;
}

/**
 * Fetch coach by email (used for SF Coach_1_Email__c / Coach_2_Email__c match candidates).
 * Coaches table has occasional duplicate rows per email — `.limit(1)` picks
 * whichever the index returns first; the duplicates have identical name/photo.
 */
export async function fetchCoachByEmail(coachEmail: string): Promise<Coach | null> {
  if (!coachEmail) return null;
  const { data, error } = await supabase
    .from('coaches')
    .select(COACH_PUBLIC_COLUMNS)
    .ilike('email', coachEmail.trim())
    .order('photo_url', { ascending: false, nullsFirst: false })
    .limit(1);
  if (!error && data && data.length > 0) return data[0] as unknown as Coach;
  return null;
}

export async function fetchCoachById(coachId: string): Promise<Coach | null> {
  devLog('[fetchCoachById] Searching for coach:', coachId);

  const { data, error } = await supabase
    .from('coaches')
    .select(COACH_PUBLIC_COLUMNS)
    .eq('id', coachId)
    .single();

  if (!error && data) {
    const coach = data as unknown as Coach;
    devLog('[fetchCoachById] Found coach (direct query):', {
      name: coach.name,
      hasPhotoUrl: !!coach.photo_url,
      photoUrl: coach.photo_url
    });
    return coach;
  }

  // Fallback: Try RPC function which uses SECURITY DEFINER to bypass RLS
  devLog('[fetchCoachById] Direct query failed, trying RPC function');
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_coach_by_id', { coach_id_param: coachId });

  // RPC returns JSONB (single object), not an array
  if (!rpcError && rpcData) {
    devLog('[fetchCoachById] Found coach via RPC:', {
      name: rpcData?.name,
      hasPhotoUrl: !!rpcData?.photo_url,
      photoUrl: rpcData?.photo_url
    });
    return rpcData as Coach;
  }

  devLog('[fetchCoachById] No coach found for ID:', {
    coachId,
    directError: error?.message,
    rpcError: rpcError?.message
  });
  return null;
}

/**
 * Parse special_services string into prioritized specialty tags
 * Priority: ADHD, Neurodivergence, LGBTQIA+, Working Mothers, then Leadership, Stress, etc.
 */
export function parseCoachSpecialties(specialServices: string | null, maxTags: number = 4): string[] {
  if (!specialServices) return [];

  const allSpecialties = specialServices.split(';').map(s => s.trim()).filter(Boolean);

  // Priority specialties (show these first if present)
  const priorityKeywords = [
    'ADHD',
    'Neurodiverg',
    'LGBTQ',
    'Working Mother',
    'Working Parent',
    'Women in Leadership',
  ];

  const priorityMatches: string[] = [];
  const otherSpecialties: string[] = [];

  allSpecialties.forEach(specialty => {
    const isPriority = priorityKeywords.some(keyword =>
      specialty.toLowerCase().includes(keyword.toLowerCase())
    );
    if (isPriority) {
      priorityMatches.push(specialty);
    } else {
      otherSpecialties.push(specialty);
    }
  });

  // Combine priority first, then others, limited to maxTags
  return [...priorityMatches, ...otherSpecialties].slice(0, maxTags);
}

/**
 * Get coach title line based on product certifications and ICF level
 */
export function getCoachTitleLine(coach: Coach | null, programType?: ProgramType | null): string {
  if (!coach) return 'Executive Coach';

  // Determine product type
  let productLabel = 'COACH';
  if (programType === 'EXEC' || coach.is_exec_coach) {
    productLabel = 'EXECUTIVE COACH';
  } else if (programType === 'GROW' || coach.is_grow_coach) {
    productLabel = 'LEADERSHIP COACH';
  } else if (programType === 'SCALE' || coach.is_scale_coach) {
    productLabel = 'COACH';
  }

  // Add ICF level if available
  if (coach.icf_level) {
    return `${productLabel} · ${coach.icf_level}`;
  }

  return productLabel;
}

/**
 * Get coach background line for Industry Practitioners
 */
export function getCoachBackgroundLine(coach: Coach | null): string | null {
  if (!coach) return null;

  // Only show for Industry Practitioners with companies
  if (coach.practitioner_type !== 'Industry Practitioner') return null;
  if (!coach.companies || coach.companies.length === 0) return null;

  // Get primary industry label
  const industryLabel = coach.industries?.[0] || 'Executive';

  // Format: "Former [industry] · [companies]"
  const companiesStr = coach.companies.slice(0, 3).join(' · ');
  return `Former ${industryLabel} · ${companiesStr}`;
}

/**
 * Fetch match summary for a coach-employee pairing
 * Tries welcome_survey_scale first, then welcome_survey_baseline
 * Uses employee_id for lookup, with email fallback
 */
export async function fetchMatchSummary(employeeId: string, email?: string): Promise<string | null> {
  devLog('[fetchMatchSummary] Looking up match_summary for employee_id:', employeeId, 'email:', email);

  // Try welcome_survey_scale by employee_id first
  const { data: scaleData, error: scaleError } = await supabase
    .from('welcome_survey_scale')
    .select('match_summary, employee_id, email')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(1);

  devLog('[fetchMatchSummary] welcome_survey_scale by employee_id result:', { scaleData, scaleError });

  if (!scaleError && scaleData && scaleData.length > 0 && scaleData[0].match_summary) {
    devLog('[fetchMatchSummary] Found in welcome_survey_scale:', scaleData[0].match_summary);
    return scaleData[0].match_summary;
  }

  // Try welcome_survey_scale by email as fallback
  if (email) {
    const { data: scaleByEmail, error: scaleEmailError } = await supabase
      .from('welcome_survey_scale')
      .select('match_summary, employee_id, email')
      .ilike('email', email)
      .order('created_at', { ascending: false })
      .limit(1);

    devLog('[fetchMatchSummary] welcome_survey_scale by email result:', { scaleByEmail, scaleEmailError });

    if (!scaleEmailError && scaleByEmail && scaleByEmail.length > 0 && scaleByEmail[0].match_summary) {
      devLog('[fetchMatchSummary] Found in welcome_survey_scale by email:', scaleByEmail[0].match_summary);
      return scaleByEmail[0].match_summary;
    }
  }

  // Fallback to welcome_survey_baseline by employee_id
  const { data: baselineData, error: baselineError } = await supabase
    .from('welcome_survey_baseline')
    .select('match_summary, employee_id, email')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(1);

  devLog('[fetchMatchSummary] welcome_survey_baseline result:', { baselineData, baselineError });

  if (!baselineError && baselineData && baselineData.length > 0 && baselineData[0].match_summary) {
    devLog('[fetchMatchSummary] Found in welcome_survey_baseline:', baselineData[0].match_summary);
    return baselineData[0].match_summary;
  }

  // Try welcome_survey_baseline by email as fallback
  if (email) {
    const { data: baselineByEmail, error: baselineEmailError } = await supabase
      .from('welcome_survey_baseline')
      .select('match_summary, employee_id, email')
      .ilike('email', email)
      .order('created_at', { ascending: false })
      .limit(1);

    devLog('[fetchMatchSummary] welcome_survey_baseline by email result:', { baselineByEmail, baselineEmailError });

    if (!baselineEmailError && baselineByEmail && baselineByEmail.length > 0 && baselineByEmail[0].match_summary) {
      devLog('[fetchMatchSummary] Found in welcome_survey_baseline by email:', baselineByEmail[0].match_summary);
      return baselineByEmail[0].match_summary;
    }
  }

  devLog('[fetchMatchSummary] No match_summary found for employee_id:', employeeId);
  return null;
}

// ============================================
// MESSAGING INTEGRATIONS (Slack + Teams)
// ============================================

const SLACK_FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slack-oauth`
  : '/functions/v1/slack-oauth';

const TEAMS_FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/teams-oauth`
  : '/functions/v1/teams-oauth';

/**
 * Get Slack connection status for the current user
 */
export async function fetchSlackConnectionStatus(): Promise<SlackConnectionStatus> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return { connected: false, settings: null };
    }

    const response = await fetch(`${SLACK_FUNCTION_URL}?action=status`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch Slack status');
      return { connected: false, settings: null };
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching Slack connection:', error);
    return { connected: false, settings: null };
  }
}

/**
 * Get the URL to start Slack OAuth flow
 */
export function getSlackConnectUrl(email: string): string {
  return `${SLACK_FUNCTION_URL}?action=start&email=${encodeURIComponent(email)}`;
}

/**
 * Disconnect Slack integration
 */
export async function disconnectSlack(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return false;
    }

    const response = await fetch(`${SLACK_FUNCTION_URL}?action=disconnect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Error disconnecting Slack:', error);
    return false;
  }
}

/**
 * Update Slack nudge settings
 */
export async function updateSlackSettings(settings: {
  nudge_enabled?: boolean;
  nudge_frequency?: 'smart' | 'daily' | 'weekly' | 'none';
  preferred_time?: string;
  timezone?: string;
}): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return false;
    }

    const response = await fetch(`${SLACK_FUNCTION_URL}?action=settings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });

    return response.ok;
  } catch (error) {
    console.error('Error updating Slack settings:', error);
    return false;
  }
}

/**
 * Get Teams connection status for the current user
 */
export async function fetchTeamsConnectionStatus(): Promise<TeamsConnectionStatus> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return { connected: false, settings: null };
    }

    const response = await fetch(`${TEAMS_FUNCTION_URL}?action=status`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch Teams status');
      return { connected: false, settings: null };
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching Teams connection:', error);
    return { connected: false, settings: null };
  }
}

/**
 * Get the URL to start Teams OAuth flow
 */
export function getTeamsConnectUrl(email: string): string {
  return `${TEAMS_FUNCTION_URL}?action=start&email=${encodeURIComponent(email)}`;
}

/**
 * Disconnect Teams integration
 */
export async function disconnectTeams(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return false;
    }

    const response = await fetch(`${TEAMS_FUNCTION_URL}?action=disconnect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Error disconnecting Teams:', error);
    return false;
  }
}

/**
 * Update Teams nudge settings
 */
export async function updateTeamsSettings(settings: {
  nudge_enabled?: boolean;
  nudge_frequency?: 'smart' | 'daily' | 'weekly' | 'none';
  preferred_time?: string;
  timezone?: string;
}): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return false;
    }

    const response = await fetch(`${TEAMS_FUNCTION_URL}?action=settings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });

    return response.ok;
  } catch (error) {
    console.error('Error updating Teams settings:', error);
    return false;
  }
}

/**
 * Fetch nudge history for the current user (last 30 days, both channels)
 */
export async function fetchNudgeHistory(email: string): Promise<Nudge[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Query the unified nudges table (backward-compatible view also works)
  const { data, error } = await supabase
    .from('nudges')
    .select('*')
    .ilike('employee_email', email)
    .gte('sent_at', thirtyDaysAgo.toISOString())
    .order('sent_at', { ascending: false })
    .limit(20);

  if (error) {
    // Fall back to slack_nudges view if nudges table isn't available yet
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('slack_nudges')
      .select('*')
      .ilike('employee_email', email)
      .gte('sent_at', thirtyDaysAgo.toISOString())
      .order('sent_at', { ascending: false })
      .limit(20);

    if (fallbackError) {
      console.error('Error fetching nudge history:', fallbackError);
      return [];
    }

    return (fallbackData as Nudge[]) || [];
  }

  return (data as Nudge[]) || [];
}

// ============================================
// POST-PROGRAM REFLECTION
// ============================================

/**
 * Fetch reflection response for a user (post-program assessment)
 */
export async function fetchReflection(email: string): Promise<ReflectionResponse | null> {
  const { data, error } = await supabase
    .from('reflection_responses')
    .select('*')
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    // reflection_responses is a dead-code table that never shipped; the
    // state machine falls back to competency_scores (score_type='end_of_program')
    // via hasEndOfProgramScores in coachingState.ts. PGRST205 = schema cache
    // miss, 42P01 = relation does not exist, PGRST116 = no rows. All silent.
    const silentCodes = ['42P01', 'PGRST116', 'PGRST205'];
    if (!silentCodes.includes(error.code)) {
      console.error('Error fetching reflection:', error);
    }
    return null;
  }

  return (data && data.length > 0) ? data[0] as ReflectionResponse : null;
}

/**
 * Submit post-program reflection
 */
export async function submitReflection(
  email: string,
  reflection: Omit<ReflectionResponse, 'id' | 'email' | 'created_at'>
): Promise<{ success: boolean; data?: ReflectionResponse; error?: string }> {
  const { data, error } = await supabase
    .from('reflection_responses')
    .insert({
      email: email.toLowerCase(),
      ...reflection,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error submitting reflection:', error);
    return { success: false, error: error.message };
  }

  return { success: true, data: data as ReflectionResponse };
}

// ============================================
// SCALE CHECKPOINTS (Longitudinal Tracking)
// ============================================

/**
 * Fetch all checkpoints (check-ins) for a SCALE user from survey_submissions
 * Includes first_session, feedback, and touchpoint survey types
 */
export async function fetchCheckpoints(email: string): Promise<Checkpoint[]> {
  const { data, error } = await supabase
    .from('survey_submissions')
    .select('*')
    .ilike('email', email)
    .in('survey_type', ['first_session', 'feedback', 'touchpoint'])
    .order('submitted_at', { ascending: true });

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching checkpoints:', error);
    }
    return [];
  }

  // Helper to extract session number from outcomes field (format: "Session X, ...")
  const extractSessionNumber = (outcomes: string | null): number => {
    if (!outcomes) return 1;
    const match = outcomes.match(/Session\s+(\d+)/i);
    return match ? parseInt(match[1], 10) : 1;
  };

  // Map survey_submissions to Checkpoint type
  return (data || []).map((s: Record<string, unknown>) => {
    const sessionNum = extractSessionNumber(s.outcomes as string | null);
    return {
      id: s.id as string,
      email: s.email as string,
      checkpoint_number: sessionNum,
      session_count_at_checkpoint: sessionNum,
      competency_scores: {
        adaptability_and_resilience: s.coach_satisfaction as number || 0,
        building_relationships_at_work: 0,
        change_management: 0,
        delegation_and_accountability: 0,
        effective_communication: 0,
        effective_planning_and_execution: 0,
        emotional_intelligence: 0,
        giving_and_receiving_feedback: 0,
        persuasion_and_influence: 0,
        self_confidence_and_imposter_syndrome: 0,
        strategic_thinking: 0,
        time_management_and_productivity: 0,
      },
      reflection_text: s.feedback_suggestions as string | null,
      focus_area: null,
      nps_score: s.nps as number | null,
      testimonial_consent: s.open_to_testimonial as boolean || false,
      created_at: s.submitted_at as string || s.created_at as string,
      // Session 6+ wellbeing data
      wellbeing_satisfaction: s.wellbeing_satisfaction as number | null,
      wellbeing_productivity: s.wellbeing_productivity as number | null,
      wellbeing_balance: s.wellbeing_balance as number | null,
    };
  }) as Checkpoint[];
}

/**
 * Fetch the latest checkpoint (check-in) for a SCALE user
 */
export async function fetchLatestCheckpoint(email: string): Promise<Checkpoint | null> {
  const { data, error } = await supabase
    .from('survey_submissions')
    .select('*')
    .ilike('email', email)
    .in('survey_type', ['first_session', 'feedback', 'touchpoint'])
    .order('submitted_at', { ascending: false })
    .limit(1);

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching latest checkpoint:', error);
    }
    return null;
  }

  if (!data || data.length === 0) return null;

  // Helper to extract session number from outcomes field (format: "Session X, ...")
  const extractSessionNumber = (outcomes: string | null): number => {
    if (!outcomes) return 1;
    const match = outcomes.match(/Session\s+(\d+)/i);
    return match ? parseInt(match[1], 10) : 1;
  };

  const s = data[0];
  const sessionNum = extractSessionNumber(s.outcomes);
  return {
    id: s.id,
    email: s.email,
    checkpoint_number: sessionNum,
    session_count_at_checkpoint: sessionNum,
    competency_scores: {
      adaptability_and_resilience: s.coach_satisfaction || 0,
      building_relationships_at_work: 0,
      change_management: 0,
      delegation_and_accountability: 0,
      effective_communication: 0,
      effective_planning_and_execution: 0,
      emotional_intelligence: 0,
      giving_and_receiving_feedback: 0,
      persuasion_and_influence: 0,
      self_confidence_and_imposter_syndrome: 0,
      strategic_thinking: 0,
      time_management_and_productivity: 0,
    },
    reflection_text: s.feedback_suggestions,
    focus_area: null,
    nps_score: s.nps,
    testimonial_consent: s.open_to_testimonial || false,
    created_at: s.submitted_at || s.created_at,
    // Session 6+ wellbeing data
    wellbeing_satisfaction: s.wellbeing_satisfaction as number | null,
    wellbeing_productivity: s.wellbeing_productivity as number | null,
    wellbeing_balance: s.wellbeing_balance as number | null,
  } as Checkpoint;
}

/**
 * Submit a SCALE check-in to survey_submissions
 */
export interface ScaleCheckinData {
  sessionId: string;
  sessionNumber: number;
  coachName: string;
  sessionRating: number;         // 1-10 (experience rating)
  coachMatchRating: number;      // 1-10
  feedbackText: string | null;   // Combined text feedback
  nps: number;                   // 0-10
  testimonialConsent: boolean;
  // New fields for proper column mapping
  nextSessionBooked: boolean | null;
  notBookedReasons: string[] | null;
  openToFollowup: boolean | null;
  // Employee data (passed from component, not re-fetched)
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;      // Maps to survey_submissions.account_name
  coachingProgram: string | null;  // Maps to survey_submissions.program_title
  companyId: string | null;        // Maps to survey_submissions.company_id
  // Session 6+ wellbeing data (maps to dedicated columns)
  wellbeingSatisfaction: number | null;
  wellbeingProductivity: number | null;
  wellbeingBalance: number | null;
  // Session 6+ benefits (maps to dedicated boolean columns)
  benefitProductive: boolean;
  benefitStress: boolean;
  benefitPresent: boolean;
  benefitTalents: boolean;      // "More confident in my abilities"
  benefitOptimistic: boolean;
}

export async function submitCheckpoint(
  email: string,
  data: ScaleCheckinData
): Promise<{ success: boolean; data?: Checkpoint; error?: string }> {
  // Determine survey_type based on session number
  // Session 1 → first_session, Session 3 → feedback, Session 6+ → touchpoint
  let surveyType: string;
  if (data.sessionNumber === 1) {
    surveyType = 'first_session';
  } else if (data.sessionNumber === 3) {
    surveyType = 'feedback';
  } else {
    surveyType = 'touchpoint';
  }

  // Build outcomes to include session info and coach match rating
  const outcomesParts: string[] = [];
  if (data.sessionNumber) outcomesParts.push(`Session ${data.sessionNumber}`);
  if (data.coachMatchRating) outcomesParts.push(`Coach match: ${data.coachMatchRating}/10`);

  // Use employee data passed from the component (already loaded at app start)
  devLog('[submitCheckpoint] Using passed employee data:', {
    firstName: data.firstName,
    lastName: data.lastName,
    companyName: data.companyName,
    coachingProgram: data.coachingProgram,
  });

  // Insert with all data including employee fields
  const { data: result, error } = await supabase
    .from('survey_submissions')
    .insert({
      email: email.toLowerCase(),
      survey_type: surveyType,
      coach_name: data.coachName,
      coach_satisfaction: data.sessionRating,
      outcomes: outcomesParts.length > 0 ? outcomesParts.join(', ') : null,
      feedback_suggestions: data.feedbackText,
      nps: data.nps,
      open_to_testimonial: data.testimonialConsent,
      match_rating: data.coachMatchRating,
      next_session_booked: data.nextSessionBooked,
      not_booked_reasons: data.notBookedReasons,
      open_to_followup: data.openToFollowup,
      // Employee data (passed from component)
      first_name: data.firstName,
      last_name: data.lastName,
      // participant_name is auto-generated from first_name + last_name
      account_name: data.companyName,
      program_title: data.coachingProgram,
      company_id: data.companyId,
      // Session 6+ wellbeing data (dedicated columns for analytics)
      wellbeing_satisfaction: data.wellbeingSatisfaction,
      wellbeing_productivity: data.wellbeingProductivity,
      wellbeing_balance: data.wellbeingBalance,
      // Session 6+ benefits (dedicated boolean columns)
      benefit_productive: data.benefitProductive || null,
      benefit_stress: data.benefitStress || null,
      benefit_present: data.benefitPresent || null,
      benefit_talents: data.benefitTalents || null,
      benefit_optimistic: data.benefitOptimistic || null,
    })
    .select()
    .single();

  if (error) {
    console.error('[submitCheckpoint] Error submitting check-in:', error);
    return { success: false, error: error.message };
  }

  devLog('[submitCheckpoint] Survey saved successfully with employee data:', {
    id: result.id,
    first_name: result.first_name,
    account_name: result.account_name,
  });

  // Map back to Checkpoint type for compatibility
  const checkpoint: Checkpoint = {
    id: result.id,
    email: result.email,
    checkpoint_number: data.sessionNumber,
    session_count_at_checkpoint: data.sessionNumber,
    competency_scores: {
      adaptability_and_resilience: data.sessionRating || 0,
      building_relationships_at_work: data.coachMatchRating || 0,
      change_management: 0,
      delegation_and_accountability: 0,
      effective_communication: 0,
      effective_planning_and_execution: 0,
      emotional_intelligence: 0,
      giving_and_receiving_feedback: 0,
      persuasion_and_influence: 0,
      self_confidence_and_imposter_syndrome: 0,
      strategic_thinking: 0,
      time_management_and_productivity: 0,
    },
    reflection_text: result.feedback_suggestions,
    focus_area: null,
    nps_score: result.nps,
    testimonial_consent: result.open_to_testimonial || false,
    created_at: result.submitted_at || result.created_at,
    // Session 6+ wellbeing data
    wellbeing_satisfaction: data.wellbeingSatisfaction,
    wellbeing_productivity: data.wellbeingProductivity,
    wellbeing_balance: data.wellbeingBalance,
  };

  return { success: true, data: checkpoint };
}

// ============================================
// NATIVE SURVEY SYSTEM
// ============================================

import type {
  CoreCompetency,
  PendingSurvey,
  SurveyCompetencyScore,
  CompetencyScoreLevel,
  CoachQuality
} from './types';

/**
 * Fetch all active core competencies
 */
export async function fetchCoreCompetencies(): Promise<CoreCompetency[]> {
  const { data, error } = await supabase
    .from('core_competencies')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching competencies:', error);
    return [];
  }

  return (data as CoreCompetency[]) || [];
}

// Program-specific milestone arrays
// SCALE: feedback at sessions 1, 3, then every 6 (6, 12, 18, 24, ...)
// Generated dynamically since SCALE is ongoing with no fixed end
function getScaleMilestones(countedSessionCount: number): number[] {
  const milestones = [1, 3];
  for (let i = 6; i <= countedSessionCount + 6; i += 6) {
    milestones.push(i);
  }
  return milestones;
}
// GROW: feedback at sessions 1, midpoint (dynamically calculated), end (handled separately)

/**
 * Calculate GROW milestones based on total sessions
 * Midpoint = Math.floor(totalSessions / 2)
 * e.g., 8 sessions → midpoint at 4, 12 sessions → midpoint at 6
 */
function getGrowMilestones(totalSessions: number): { milestones: number[]; midpoint: number } {
  const midpoint = Math.floor(totalSessions / 2);
  return {
    milestones: [1, midpoint],
    midpoint,
  };
}

/**
 * Check for pending survey after login
 * Returns the OLDEST session that needs a survey (so users complete in order)
 * Handles GROW vs SCALE program types with different milestone arrays
 *
 * @param email - User's email
 * @param programType - Program type (GROW, SCALE, EXEC)
 * @param loadedSessions - Optional: already-loaded sessions to avoid re-querying
 */
// Survey types that are anchored to a specific session and lose their value
// once that session is far enough in the past. Structural surveys
// (midpoint, end_of_program, grow_baseline, grow_end) are not in this set —
// those gate the program and remain valid regardless of session age.
const SESSION_ANCHORED_SURVEY_TYPES = ['feedback', 'touchpoint', 'first_session', 'sixth_session'];
const STALE_SURVEY_DAYS = 30;

function isStalePendingSurvey(survey: PendingSurvey | null | undefined): boolean {
  if (!survey || !SESSION_ANCHORED_SURVEY_TYPES.includes(survey.survey_type)) return false;
  if (!survey.session_date) return false;
  const ageDays = (Date.now() - new Date(survey.session_date).getTime()) / 86_400_000;
  return ageDays > STALE_SURVEY_DAYS;
}

export async function fetchPendingSurvey(
  email: string,
  programType?: string | null,
  loadedSessions?: Array<{ id: string; appointment_number: string | null; session_date: string; coach_name: string; status: string }>
): Promise<PendingSurvey | null> {
  devLog('[fetchPendingSurvey] Checking for pending survey:', { email, programType, hasLoadedSessions: !!loadedSessions });

  const normalizedProgram = programType?.toUpperCase() || '';
  const isScale = normalizedProgram === 'SCALE' || normalizedProgram.startsWith('SCALE') || normalizedProgram.startsWith('SLX');

  // SCALE feedback flows through CheckpointFlow, which writes the canonical
  // (rich, structured) survey_submissions row. Returning a SurveyModal pending
  // here would race against the checkpoint modal and write a sparse duplicate.
  if (isScale) {
    return null;
  }

  // First, try the RPC function (uses the comprehensive pending_surveys view).
  // The RPC isn't deployed in every environment — PGRST202 (no function found)
  // is expected and handled by the fallback below; only log other errors.
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_pending_survey', { user_email: email });

  if (rpcError && rpcError.code !== 'PGRST202' && rpcError.code !== '42883') {
    devLog('[fetchPendingSurvey] RPC error:', rpcError);
  }

  if (!rpcError && rpcData && rpcData.length > 0) {
    const candidate = rpcData[0] as PendingSurvey;
    if (isStalePendingSurvey(candidate)) {
      // Don't block a returning user with feedback for a session they barely remember.
      // The survey row stays in the DB and remains accessible from session detail.
      devLog('[fetchPendingSurvey] Skipping stale session-anchored survey:', {
        survey_type: candidate.survey_type,
        session_date: candidate.session_date,
      });
      return null;
    }
    devLog('[fetchPendingSurvey] Found via RPC:', candidate);
    return candidate;
  }

  // Fallback: use loaded sessions if available
  const isGrow = normalizedProgram === 'GROW' || normalizedProgram.startsWith('GROW');

  // For GROW programs, calculate midpoint
  const sessionsPerEmployee = isGrow ? 12 : 36; // defaults
  const growMidpoint = Math.floor(sessionsPerEmployee / 2);

  // Use loaded sessions if available, otherwise we can't check (RPC should have worked)
  if (!loadedSessions || loadedSessions.length === 0) {
    devLog('[fetchPendingSurvey] No loaded sessions available and RPC failed');
    return null;
  }

  // Statuses that count towards session totals (late cancel, no-show count towards milestones)
  const COUNTED_STATUSES = ['Completed', 'Late Cancel', 'Client No-Show'];

  // Filter to sessions that count towards total and sort by date (oldest first) to determine session number
  // Note: appointment_number contains Salesforce IDs (e.g. "SA-107788"), not sequential numbers
  // So we calculate session number based on chronological order
  const countedSessions = loadedSessions
    .filter(s => COUNTED_STATUSES.includes(s.status))
    .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime());

  // Calculate milestones (SCALE generates dynamically based on session count)
  const milestones = isGrow ? getGrowMilestones(sessionsPerEmployee).milestones : getScaleMilestones(countedSessions.length);

  devLog('[fetchPendingSurvey] Checking milestones:', {
    milestones,
    isGrow,
    sessionsPerEmployee,
    growMidpoint: isGrow ? growMidpoint : 'N/A',
  });

  // Also track just completed sessions (for attaching surveys)
  const completedSessions = loadedSessions
    .filter(s => s.status === 'Completed')
    .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime());

  devLog('[fetchPendingSurvey] Counted sessions (sorted by date):', countedSessions.map((s, idx) => ({
    id: s.id,
    sessionNumber: idx + 1,
    session_date: s.session_date,
    status: s.status
  })));

  // Find sessions at milestone numbers (based on their position in counted sessions)
  // For surveys, we want to attach to completed sessions, so find the completed session
  // that corresponds to each milestone position
  const milestoneSessions = countedSessions
    .map((session, index) => ({
      ...session,
      calculatedSessionNumber: index + 1 // 1-indexed session number
    }))
    .filter(s => milestones.includes(s.calculatedSessionNumber) && s.status === 'Completed');

  devLog('[fetchPendingSurvey] Sessions at milestones:', {
    total: loadedSessions.length,
    counted: countedSessions.length,
    completed: completedSessions.length,
    atMilestones: milestoneSessions.length,
    milestoneDetails: milestoneSessions.map(s => ({
      id: s.id,
      sessionNumber: s.calculatedSessionNumber,
      date: s.session_date,
      status: s.status
    })),
  });

  if (milestoneSessions.length === 0) {
    devLog('[fetchPendingSurvey] No milestone sessions found');
    return null;
  }

  // Check for end-of-program survey first (GROW/EXEC only, SCALE is ongoing)
  if (isGrow && countedSessions.length >= sessionsPerEmployee) {
    const { data: existingEndSurvey } = await supabase
      .from('survey_submissions')
      .select('id')
      .ilike('email', email)
      .in('survey_type', ['end_of_program', 'grow_end'])
      .limit(1);

    if (!existingEndSurvey || existingEndSurvey.length === 0) {
      // Get the latest completed session
      const latestCompletedSession = completedSessions[completedSessions.length - 1];
      if (latestCompletedSession) {
        return {
          session_id: latestCompletedSession.id,
          session_number: countedSessions.length,
          session_date: latestCompletedSession.session_date,
          coach_name: latestCompletedSession.coach_name || 'Your Coach',
          survey_type: isGrow ? 'grow_end' : 'end_of_program',
        };
      }
    }
  }

  // Check which milestone sessions don't have a survey yet
  for (const session of milestoneSessions) {
    const sessionNum = session.calculatedSessionNumber;
    const sessionPattern = `Session ${sessionNum}`;
    devLog('[fetchPendingSurvey] Checking for existing survey:', {
      sessionPattern,
      sessionId: session.id,
      calculatedSessionNumber: sessionNum
    });

    const { data: existingSurvey } = await supabase
      .from('survey_submissions')
      .select('id')
      .ilike('email', email)
      .ilike('outcomes', `%${sessionPattern}%`)
      .limit(1);

    devLog('[fetchPendingSurvey] Existing survey check:', { existingSurvey });

    if (!existingSurvey || existingSurvey.length === 0) {
      // Skip stale surveys: if the user is more than 5 sessions past this milestone, don't prompt
      if (countedSessions.length - sessionNum > 5) {
        devLog('[fetchPendingSurvey] Skipping stale survey for session', sessionNum,
          '(current count:', countedSessions.length, ')');
        continue;
      }

      // Determine survey type based on program and session number
      // For GROW: session 1 = first_session, midpoint = midpoint
      // For SCALE: all milestones = feedback
      let surveyType: 'feedback' | 'first_session' | 'midpoint' = 'feedback';
      if (isGrow) {
        if (sessionNum === 1) {
          surveyType = 'first_session';
        } else if (sessionNum === growMidpoint) {
          surveyType = 'midpoint';
        }
      }

      const pending: PendingSurvey = {
        session_id: session.id,
        session_number: sessionNum,
        session_date: session.session_date,
        coach_name: session.coach_name || 'Your Coach',
        survey_type: surveyType,
      };
      if (isStalePendingSurvey(pending)) {
        devLog('[fetchPendingSurvey] Skipping stale session-anchored survey (fallback path):', {
          survey_type: pending.survey_type,
          session_date: pending.session_date,
        });
        continue;
      }
      devLog('[fetchPendingSurvey] Found pending survey:', pending);
      return pending;
    }
  }

  return null;
}

/**
 * Fetch survey by session ID (for /feedback?session_id=xxx route)
 */
export async function fetchSurveyContext(sessionId: string): Promise<{
  session_id: string;
  session_number: number;
  session_date: string;
  coach_name: string;
  employee_email: string;
} | null> {
  const { data, error } = await supabase
    .from('session_tracking')
    .select('id, appointment_number, session_date, coach_name, employee_email')
    .eq('id', sessionId)
    .single();

  if (error || !data) {
    console.error('Error fetching survey context:', error);
    return null;
  }

  return {
    session_id: data.id,
    session_number: data.appointment_number,
    session_date: data.session_date,
    coach_name: data.coach_name || 'Your Coach',
    employee_email: data.employee_email,
  };
}

/**
 * Submit a SCALE feedback survey
 */
export async function submitScaleFeedbackSurvey(
  email: string,
  _sessionId: string, // Kept for API compatibility, stored in outcomes instead
  sessionNumber: number,
  coachName: string,
  data: {
    coach_satisfaction: number;
    experience_rating?: number;
    wants_rematch?: boolean;
    rematch_reason?: string;
    whats_not_working?: string;
    coach_qualities: CoachQuality[];
    has_booked_next_session: boolean;
    booking_blockers?: string[];
    nps: number;
    feedback_suggestions?: string;
    // Extra fields for SCALE_END
    outcomes?: string;
    open_to_testimonial?: boolean;
    open_to_chat?: boolean;
  },
  surveyType: 'feedback' | 'end_of_program' | 'midpoint' = 'feedback'
): Promise<{ success: boolean; error?: string }> {
  // Build outcomes to include session info and additional survey data
  const outcomesParts: string[] = [`Session ${sessionNumber}`];
  if (data.outcomes) outcomesParts.push(data.outcomes);

  // Build comprehensive feedback that includes all the new fields
  const feedbackParts: string[] = [];
  if (data.experience_rating) {
    feedbackParts.push(`Experience: ${data.experience_rating}/10`);
  }
  if (data.whats_not_working) {
    feedbackParts.push(`Issues: ${data.whats_not_working}`);
  }
  if (data.wants_rematch) {
    feedbackParts.push(`Wants rematch: ${data.rematch_reason || 'Yes'}`);
  }
  if (data.booking_blockers && data.booking_blockers.length > 0) {
    feedbackParts.push(`Booking blockers: ${data.booking_blockers.join(', ')}`);
  }
  if (data.open_to_chat) {
    feedbackParts.push('Open to chat: Yes');
  }
  if (data.feedback_suggestions) {
    feedbackParts.push(data.feedback_suggestions);
  }

  const combinedFeedback = feedbackParts.join(' | ');

  // Use RPC function to bypass RLS issues
  const { error } = await supabase
    .rpc('submit_survey_for_user', {
      user_email: email.toLowerCase(),
      p_survey_type: surveyType,
      p_coach_name: coachName,
      p_coach_satisfaction: data.coach_satisfaction,
      p_outcomes: outcomesParts.join(', '),
      p_feedback_suggestions: combinedFeedback || null,
      p_nps: data.nps,
      p_open_to_testimonial: data.open_to_testimonial || false,
    });

  if (error) {
    console.error('Error submitting survey:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Submit a GROW midpoint survey (session 6 check-in)
 */
export async function submitGrowMidpointSurvey(
  email: string,
  sessionNumber: number,
  coachName: string,
  data: {
    progress_rating: number;        // 1-10: Progress toward goals
    confidence_rating: number;      // 1-10: Confidence applying learnings
    meaningful_change?: string;     // Open text: Most meaningful change
    coach_relationship_rating: number; // 1-10: Relationship with coach
    coach_understands_rating: number;  // 1-10: Coach understands challenges
    program_pace: 'too_slow' | 'just_right' | 'too_fast';
    whats_working_well?: string;    // Open text: What's working
    what_could_improve?: string;    // Open text: What could improve
    remaining_focus?: string;       // Open text: Focus for remaining sessions
    nps: number;                    // 0-10: NPS
  }
): Promise<{ success: boolean; error?: string }> {
  // Build outcomes to include session info and ratings
  const outcomesParts: string[] = [
    `Session ${sessionNumber} Midpoint`,
    `Progress: ${data.progress_rating}/10`,
    `Confidence: ${data.confidence_rating}/10`,
    `Coach Relationship: ${data.coach_relationship_rating}/10`,
    `Coach Understanding: ${data.coach_understands_rating}/10`,
    `Pace: ${data.program_pace.replace('_', ' ')}`,
  ];

  // Build feedback with open text responses
  const feedbackParts: string[] = [];
  if (data.meaningful_change) {
    feedbackParts.push(`Meaningful change: ${data.meaningful_change}`);
  }
  if (data.whats_working_well) {
    feedbackParts.push(`Working well: ${data.whats_working_well}`);
  }
  if (data.what_could_improve) {
    feedbackParts.push(`Could improve: ${data.what_could_improve}`);
  }
  if (data.remaining_focus) {
    feedbackParts.push(`Focus for remaining: ${data.remaining_focus}`);
  }

  const combinedFeedback = feedbackParts.join(' | ');

  // Use the average of coach ratings as coach_satisfaction for compatibility
  const coachSatisfaction = Math.round(
    (data.coach_relationship_rating + data.coach_understands_rating) / 2
  );

  // Use RPC function to bypass RLS issues
  const { error } = await supabase.rpc('submit_survey_for_user', {
    user_email: email.toLowerCase(),
    p_survey_type: 'grow_midpoint',
    p_coach_name: coachName,
    p_coach_satisfaction: coachSatisfaction,
    p_outcomes: outcomesParts.join(', '),
    p_feedback_suggestions: combinedFeedback || null,
    p_nps: data.nps,
    p_open_to_testimonial: false,
  });

  if (error) {
    console.error('Error submitting midpoint survey:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Submit a GROW baseline survey (pre-program competency assessment)
 */
export async function submitGrowBaselineSurvey(
  email: string,
  competencyScores: Record<string, CompetencyScoreLevel>,
  focusAreas: string[]
): Promise<{ success: boolean; error?: string }> {
  // Insert the main survey submission
  const { data: submission, error: submissionError } = await supabase
    .from('survey_submissions')
    .insert({
      email: email.toLowerCase(),
      survey_type: 'grow_baseline',
      focus_areas: focusAreas,
      submitted_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (submissionError || !submission) {
    console.error('Error submitting baseline survey:', submissionError);
    return { success: false, error: submissionError?.message || 'Failed to create survey' };
  }

  // Insert competency scores
  const competencyRecords = Object.entries(competencyScores).map(([name, score]) => ({
    survey_submission_id: submission.id,
    email: email.toLowerCase(),
    competency_name: name,
    score,
    score_type: 'pre',
  }));

  const { error: scoresError } = await supabase
    .from('survey_competency_scores')
    .insert(competencyRecords);

  if (scoresError) {
    console.error('Error submitting competency scores:', scoresError);
    return { success: false, error: scoresError.message };
  }

  return { success: true };
}

/**
 * Submit a GROW end survey (post-program competency assessment + NPS)
 */
export async function submitGrowEndSurvey(
  email: string,
  competencyScores: Record<string, CompetencyScoreLevel>,
  data: {
    nps: number;
    outcomes: string;
    open_to_testimonial: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  // Insert the main survey submission
  const { data: submission, error: submissionError } = await supabase
    .from('survey_submissions')
    .insert({
      email: email.toLowerCase(),
      survey_type: 'grow_end',
      nps: data.nps,
      outcomes: data.outcomes,
      open_to_testimonial: data.open_to_testimonial,
      submitted_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (submissionError || !submission) {
    console.error('Error submitting end survey:', submissionError);
    return { success: false, error: submissionError?.message || 'Failed to create survey' };
  }

  // Insert competency scores (post-program)
  const competencyRecords = Object.entries(competencyScores).map(([name, score]) => ({
    survey_submission_id: submission.id,
    email: email.toLowerCase(),
    competency_name: name,
    score,
    score_type: 'post',
  }));

  const { error: scoresError } = await supabase
    .from('survey_competency_scores')
    .insert(competencyRecords);

  if (scoresError) {
    console.error('Error submitting competency scores:', scoresError);
    return { success: false, error: scoresError.message };
  }

  return { success: true };
}

/**
 * Submit a GROW first session survey (post-first-session check-in)
 */
export async function submitGrowFirstSessionSurvey(
  email: string,
  sessionNumber: number,
  coachName: string,
  data: {
    experience_rating: number;
    coach_match_rating: number;
    not_working_reason?: string;
    continue_with_coach?: boolean;
    better_match_feedback?: string;
    win_text?: string;
    has_booked_next_session?: boolean;
    not_booking_reasons?: string[];
    feedback_suggestions?: string;
    nps: number;
    open_to_chat: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  // Build outcomes string with session info
  const outcomesParts: string[] = [`Session ${sessionNumber}`];

  // Build comprehensive feedback that includes all survey data
  const feedbackParts: string[] = [];
  feedbackParts.push(`Experience: ${data.experience_rating}/10`);
  feedbackParts.push(`Coach match: ${data.coach_match_rating}/10`);

  if (data.not_working_reason) {
    feedbackParts.push(`Issues: ${data.not_working_reason}`);
  }
  if (data.continue_with_coach === false && data.better_match_feedback) {
    feedbackParts.push(`Better match: ${data.better_match_feedback}`);
  }
  if (data.not_booking_reasons && data.not_booking_reasons.length > 0) {
    feedbackParts.push(`Not booking: ${data.not_booking_reasons.join(', ')}`);
  }
  if (data.open_to_chat) {
    feedbackParts.push('Open to chat: Yes');
  }
  if (data.feedback_suggestions) {
    feedbackParts.push(data.feedback_suggestions);
  }

  const combinedFeedback = feedbackParts.join(' | ');

  // Use RPC function to bypass RLS issues
  const { error } = await supabase
    .rpc('submit_survey_for_user', {
      user_email: email.toLowerCase(),
      p_survey_type: 'first_session',
      p_coach_name: coachName,
      p_coach_satisfaction: data.coach_match_rating, // Use coach match rating
      p_outcomes: outcomesParts.join(', '),
      p_feedback_suggestions: combinedFeedback || null,
      p_nps: data.nps,
      p_open_to_testimonial: data.open_to_chat, // Reuse this field for open_to_chat
    });

  if (error) {
    console.error('Error submitting grow first session survey:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Fetch user's competency scores (for progress comparison)
 */
export async function fetchUserCompetencyScores(email: string): Promise<SurveyCompetencyScore[]> {
  const { data, error } = await supabase
    .from('survey_competency_scores')
    .select('*')
    .ilike('email', email)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching competency scores:', error);
    return [];
  }

  return (data as SurveyCompetencyScore[]) || [];
}

/**
 * Check if user has completed baseline survey (for GROW program)
 */
export async function hasCompletedBaselineSurvey(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('survey_submissions')
    .select('id')
    .ilike('email', email)
    .eq('survey_type', 'grow_baseline')
    .limit(1);

  if (error) {
    console.error('Error checking baseline survey:', error);
    return false;
  }

  return data && data.length > 0;
}

// ============================================
// GROW DASHBOARD DATA FETCHERS
// ============================================

export interface ProgramInfo {
  program_title: string | null;
  program_type: string;
  sessions_per_employee: number;
  program_start_date: string | null;
  program_end_date: string | null;
}

/**
 * Fetch program configuration for a participant
 * Looks up via employee's program field -> programs table
 */
export async function fetchProgramInfo(programId: string | null): Promise<ProgramInfo | null> {
  if (!programId) return null;

  const upperProgram = programId.toUpperCase();

  // Determine program type from name pattern first
  let programType = 'SCALE';
  if (upperProgram === 'GROW' || upperProgram.startsWith('GROW ') || upperProgram.startsWith('GROW-')) {
    programType = 'GROW';
  } else if (upperProgram === 'EXEC' || upperProgram.startsWith('EXEC ') || upperProgram.startsWith('EXEC-')) {
    programType = 'EXEC';
  }

  // Try to look up by ID first (if it looks like a UUID)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(programId);

  if (isUuid) {
    const { data, error } = await supabase
      .from('programs')
      .select('name, program_type, sessions_per_employee, program_end_date')
      .eq('id', programId)
      .single();

    if (!error && data) {
      return {
        program_title: data.name || programId,
        program_type: data.program_type || programType,
        sessions_per_employee: data.sessions_per_employee || (programType === 'GROW' ? 12 : 36),
        program_start_date: null,
        program_end_date: data.program_end_date || null,
      };
    }
  }

  // Try to look up by name/title
  const { data: byName, error: nameError } = await supabase
    .from('programs')
    .select('name, program_type, sessions_per_employee, program_end_date')
    .ilike('name', `%${programId}%`)
    .limit(1)
    .single();

  if (!nameError && byName) {
    return {
      program_title: byName.name || programId,
      program_type: byName.program_type || programType,
      sessions_per_employee: byName.sessions_per_employee || (programType === 'GROW' ? 12 : 36),
      program_start_date: null,
      program_end_date: byName.program_end_date || null,
    };
  }

  // Return defaults based on inferred program type
  return {
    program_title: programId,
    program_type: programType,
    sessions_per_employee: programType === 'GROW' ? 12 : 36,
    program_start_date: null,
    program_end_date: null,
  };
}

export interface GrowFocusArea {
  competency_name: string;
  baseline_score: CompetencyScoreLevel;
}

/**
 * Fetch participant's GROW focus areas and baseline scores
 * Gets the 3 focus areas they selected plus their baseline scores
 */
// Map of focus_* field names to display labels
const GROW_FOCUS_AREA_LABELS: Record<string, string> = {
  focus_effective_communication: 'Effective Communication',
  focus_persuasion_and_influence: 'Persuasion & Influence',
  focus_giving_and_receiving_feedback: 'Giving & Receiving Feedback',
  focus_building_relationships: 'Building Relationships',
  focus_delegation_and_accountability: 'Delegation & Accountability',
  focus_planning_and_execution: 'Planning & Execution',
  focus_change_management: 'Change Management',
  focus_emotional_intelligence: 'Emotional Intelligence',
  focus_self_confidence: 'Self Confidence',
  focus_adaptability_and_resilience: 'Adaptability & Resilience',
  focus_strategic_thinking: 'Strategic Thinking',
  focus_time_management: 'Time Management',
};

export async function fetchGrowFocusAreas(email: string): Promise<GrowFocusArea[]> {
  // First, try to get focus areas from survey_submissions (native survey)
  const { data: surveyData } = await supabase
    .from('survey_submissions')
    .select('focus_areas')
    .ilike('email', email)
    .eq('survey_type', 'grow_baseline')
    .order('submitted_at', { ascending: false })
    .limit(1);

  let focusAreas: string[] = [];

  if (surveyData && surveyData.length > 0 && surveyData[0].focus_areas) {
    focusAreas = surveyData[0].focus_areas;
  } else {
    // Fallback: Try to get from welcome_survey_baseline
    const { data: baselineData } = await supabase
      .from('welcome_survey_baseline')
      .select('coaching_priorities, focus_effective_communication, focus_persuasion_and_influence, focus_giving_and_receiving_feedback, focus_building_relationships, focus_delegation_and_accountability, focus_planning_and_execution, focus_change_management, focus_emotional_intelligence, focus_self_confidence, focus_adaptability_and_resilience, focus_strategic_thinking, focus_time_management')
      .ilike('email', email)
      .limit(1);

    if (baselineData && baselineData.length > 0) {
      const baseline = baselineData[0];

      // First try coaching_priorities
      if (baseline.coaching_priorities) {
        const priorities = baseline.coaching_priorities;
        if (Array.isArray(priorities)) {
          focusAreas = priorities.slice(0, 3);
        } else if (typeof priorities === 'string') {
          focusAreas = priorities.split(',').map((p: string) => p.trim()).slice(0, 3);
        }
      }

      // If no coaching_priorities, check focus_* boolean fields
      if (focusAreas.length === 0) {
        const selectedFocusAreas: string[] = [];
        for (const [fieldName, label] of Object.entries(GROW_FOCUS_AREA_LABELS)) {
          const value = (baseline as Record<string, unknown>)[fieldName];
          if (value === true || value === 'true') {
            selectedFocusAreas.push(label);
          }
        }
        focusAreas = selectedFocusAreas.slice(0, 3);
      }
    }
  }

  if (focusAreas.length === 0) {
    return [];
  }

  // Get baseline scores for focus areas from survey_competency_scores
  const { data: scores } = await supabase
    .from('survey_competency_scores')
    .select('competency_name, score')
    .ilike('email', email)
    .eq('score_type', 'pre')
    .in('competency_name', focusAreas);

  // Build result with scores (default to 3 if no score found)
  return focusAreas.map(competency => {
    const scoreData = scores?.find(s => s.competency_name === competency);
    return {
      competency_name: competency,
      baseline_score: (scoreData?.score || 3) as CompetencyScoreLevel,
    };
  });
}

/**
 * Fetch all baseline competency scores for a participant
 * Used to display full competency profile on GROW dashboard
 */
export async function fetchAllBaselineScores(email: string): Promise<SurveyCompetencyScore[]> {
  const { data, error } = await supabase
    .from('survey_competency_scores')
    .select('*')
    .ilike('email', email)
    .eq('score_type', 'pre')
    .order('competency_name', { ascending: true });

  if (error) {
    console.error('Error fetching baseline scores:', error);
    return [];
  }

  return (data as SurveyCompetencyScore[]) || [];
}

// ============================================
// WELCOME SURVEY LINK (Dynamic per program)
// ============================================

/**
 * Fetch the welcome survey link from program_config for a company
 * Falls back to null if no active program has a link configured
 */
export async function fetchWelcomeSurveyLink(
  companyId: string,
  coachingProgram?: string | null
): Promise<string | null> {
  let query = supabase
    .from('program_config')
    .select('welcome_survey_link')
    .eq('company_id', companyId)
    .eq('program_status', 'Active')
    .not('welcome_survey_link', 'is', null);

  if (coachingProgram) {
    query = query.ilike('program_title', `%${coachingProgram}%`);
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error || !data?.welcome_survey_link) return null;
  return data.welcome_survey_link;
}

// ============================================
// PROGRAM CONFIG (contract periods, session caps)
// ============================================

export interface ProgramConfig {
  program_title: string | null;
  sessions_per_employee: number | null;
  program_start_date: string | null;
  program_end_date: string | null;
  program_status: string | null;
}

/**
 * Fetch program config for a company's active program
 * Used for contract-period-aware session counting (PEPM clients)
 * Returns null on miss (graceful fallback for non-PEPM clients)
 */
export async function fetchProgramConfig(
  companyId: string,
  coachingProgram?: string | null
): Promise<ProgramConfig | null> {
  let query = supabase
    .from('program_config')
    .select('program_title, sessions_per_employee, program_start_date, program_end_date, program_status')
    .eq('company_id', companyId)
    .eq('program_status', 'Active');

  if (coachingProgram) {
    query = query.ilike('program_title', `%${coachingProgram}%`);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    if (error.code !== 'PGRST116' && error.code !== '42P01' && error.code !== 'PGRST205') {
      console.error('Error fetching program config:', error);
    }
    return null;
  }

  return data as ProgramConfig | null;
}

// ============================================
// COACHING WINS
// ============================================

import type { CoachingWin } from './types';

/**
 * Fetch coaching wins for an employee
 * Returns wins ordered by most recent first
 * Uses RPC function which joins through employee_manager to find wins by email
 */
export async function fetchCoachingWins(email: string): Promise<CoachingWin[]> {
  devLog('[fetchCoachingWins] Fetching wins for email:', email);

  // Use RPC function which joins through employee_manager
  // (coaching_wins table doesn't have email column, only employee_id)
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_coaching_wins_for_user', { user_email: email });

  if (!rpcError && rpcData) {
    devLog('[fetchCoachingWins] RPC succeeded, found:', rpcData.length);
    return (rpcData as CoachingWin[]) || [];
  }

  // Log RPC error
  if (rpcError) {
    // Only log if not a "function doesn't exist" error
    if (rpcError.code !== '42883' && rpcError.code !== 'PGRST202') {
      console.error('[fetchCoachingWins] RPC failed:', rpcError);
    }
  }

  return [];
}

/**
 * Add a new coaching win (manual entry from progress page or survey)
 * Uses RPC function which handles the insert with SECURITY DEFINER
 */
export async function addCoachingWin(
  email: string,
  employeeId: string | number,
  winText: string,
  sessionNumber?: number,
  isPrivate: boolean = false,
  source: 'manual' | 'check_in_survey' = 'manual'
): Promise<{ success: boolean; data?: CoachingWin; error?: string }> {
  // Convert employeeId to number (Supabase returns BIGINT as string sometimes)
  const numericEmployeeId = typeof employeeId === 'string' ? parseInt(employeeId, 10) : employeeId;

  devLog('[addCoachingWin] Adding win for:', { email, employeeId: numericEmployeeId, winText: winText.substring(0, 50) });

  // Use RPC function which handles the insert with proper permissions
  // (coaching_wins table doesn't have email column, only employee_id)
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('add_coaching_win_for_user', {
      user_email: email,
      user_employee_id: numericEmployeeId,
      win_text_value: winText.trim(),
      session_num: sessionNumber || null,
      is_private_value: isPrivate,
      source_value: source,
    });

  if (!rpcError && rpcData) {
    devLog('[addCoachingWin] RPC succeeded');
    return { success: true, data: rpcData as CoachingWin };
  }

  // Log RPC error
  if (rpcError) {
    console.error('[addCoachingWin] RPC failed:', rpcError);
    return { success: false, error: rpcError.message };
  }

  return { success: false, error: 'Failed to add coaching win' };
}

/**
 * Delete a coaching win
 */
export async function deleteCoachingWin(
  winId: string
): Promise<{ success: boolean; error?: string }> {
  devLog('[deleteCoachingWin] Deleting win:', winId);

  const { error } = await supabase
    .from('coaching_wins')
    .delete()
    .eq('id', winId);

  if (error) {
    console.error('[deleteCoachingWin] Error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Update a coaching win's text
 */
export async function updateCoachingWin(
  winId: string,
  winText: string
): Promise<{ success: boolean; error?: string }> {
  devLog('[updateCoachingWin] Updating win:', winId);

  const { error } = await supabase
    .from('coaching_wins')
    .update({ win_text: winText.trim() })
    .eq('id', winId);

  if (error) {
    console.error('[updateCoachingWin] Error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
