/**
 * Seed script for QA test personas 3a, 3b, 4a, 4b.
 *
 * Usage:
 *   SUPABASE_URL=<url> SUPABASE_SERVICE_KEY=<key> npx tsx tests/seed.ts
 *
 * The service-role key is needed so we can bypass RLS.
 * Falls back to VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY when the
 * service-role vars are absent (will still work if RLS policies allow inserts).
 *
 * NOTE: We avoid .upsert() because several tables (employee_manager,
 * welcome_survey_scale, welcome_survey_baseline, session_tracking) lack
 * UNIQUE constraints on the columns we'd need for onConflict. Instead we
 * select-then-insert or select-then-update for idempotent seeding.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'Missing env vars. Set SUPABASE_URL + SUPABASE_SERVICE_KEY (or VITE_ equivalents).',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Shared constants ─────────────────────────────────────────────────────────

const COMPANY_ID = 'qa-test-company';
const COACH_ID = '00000000-0000-0000-0000-000000000099';
const COACH_NAME = 'Darcy Roberts';

const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 7);
futureDate.setHours(14, 0, 0, 0);

const pastDate = new Date();
pastDate.setDate(pastDate.getDate() - 3);
pastDate.setHours(14, 0, 0, 0);

// ── Generic select-then-insert/update helpers ────────────────────────────────

/**
 * Insert a row if it doesn't exist, or update it if it does.
 * Matches on `matchCol` = `matchVal`.
 */
async function selectThenUpsert(
  table: string,
  matchCol: string,
  matchVal: string,
  row: Record<string, unknown>,
): Promise<string> {
  // Check if row exists
  const { data: existing, error: selErr } = await supabase
    .from(table)
    .select('id')
    .ilike(matchCol, matchVal)
    .limit(1);

  if (selErr) throw new Error(`${table} select error: ${selErr.message}`);

  if (existing && existing.length > 0) {
    // Update existing row
    const id = existing[0].id as string;
    const { error: updErr } = await supabase
      .from(table)
      .update(row)
      .eq('id', id);
    if (updErr) throw new Error(`${table} update error: ${updErr.message}`);
    return id;
  } else {
    // Insert new row
    const { data: inserted, error: insErr } = await supabase
      .from(table)
      .insert({ [matchCol]: matchVal, ...row })
      .select('id')
      .single();
    if (insErr) throw new Error(`${table} insert error: ${insErr.message}`);
    return inserted.id as string;
  }
}

/**
 * Same as above but for tables where `id` may not be returned or we don't
 * need the id back (survey tables). Uses eq instead of ilike for exact match.
 */
async function selectThenUpsertNoId(
  table: string,
  matchCol: string,
  matchVal: string,
  row: Record<string, unknown>,
): Promise<void> {
  const { data: existing, error: selErr } = await supabase
    .from(table)
    .select(matchCol)
    .ilike(matchCol, matchVal)
    .limit(1);

  if (selErr) throw new Error(`${table} select error: ${selErr.message}`);

  if (existing && existing.length > 0) {
    const { error: updErr } = await supabase
      .from(table)
      .update(row)
      .ilike(matchCol, matchVal);
    if (updErr) throw new Error(`${table} update error: ${updErr.message}`);
  } else {
    const { error: insErr } = await supabase
      .from(table)
      .insert({ [matchCol]: matchVal, ...row });
    if (insErr) throw new Error(`${table} insert error: ${insErr.message}`);
  }
}

/**
 * For session_tracking: match on employee_email + appointment_number to avoid
 * creating duplicate sessions on repeated seed runs.
 */
async function upsertSession(
  email: string,
  appointmentNumber: string,
  row: Record<string, unknown>,
): Promise<void> {
  const { data: existing, error: selErr } = await supabase
    .from('session_tracking')
    .select('id')
    .ilike('employee_email', email)
    .eq('appointment_number', appointmentNumber)
    .limit(1);

  if (selErr) throw new Error(`session_tracking select error: ${selErr.message}`);

  if (existing && existing.length > 0) {
    const { error: updErr } = await supabase
      .from('session_tracking')
      .update(row)
      .eq('id', existing[0].id);
    if (updErr) throw new Error(`session_tracking update error: ${updErr.message}`);
  } else {
    const { error: insErr } = await supabase
      .from('session_tracking')
      .insert({ employee_email: email, appointment_number: appointmentNumber, ...row });
    if (insErr) throw new Error(`session_tracking insert error: ${insErr.message}`);
  }
}

// ── Coach ────────────────────────────────────────────────────────────────────

async function seedCoach() {
  // coaches.id IS a primary key, so upsert works here
  const { error } = await supabase.from('coaches').upsert(
    {
      id: COACH_ID,
      name: COACH_NAME,
      email: 'darcy.roberts@boon.test',
      bio: 'Darcy is a PCC-certified executive coach with 15 years of leadership experience at Fortune 500 companies. She specializes in communication, executive presence, and navigating complex stakeholder dynamics.',
      photo_url: null,
      specialties: ['Leadership', 'Communication', 'Executive Presence'],
      icf_level: 'PCC',
      practitioner_type: 'Industry Practitioner',
      headline: 'Former VP at Google, Microsoft',
      notable_credentials: 'ICF PCC, Columbia Executive Coach Certification',
      is_scale_coach: true,
      is_grow_coach: true,
      is_exec_coach: false,
    },
    { onConflict: 'id' },
  );
  if (error) console.error('Coach seed error:', error.message);
  else console.log('✓ Coach seeded');
}

// ── Employee helper ──────────────────────────────────────────────────────────

async function ensureEmployee(email: string, fields: Record<string, unknown>): Promise<string> {
  return selectThenUpsert('employee_manager', 'company_email', email, {
    company_id: COMPANY_ID,
    ...fields,
  });
}

// ── 3a  SCALE — matched, first session upcoming ─────────────────────────────

async function seedPersona3a() {
  const email = 'qa-persona-3a@boon.test';
  const empId = await ensureEmployee(email, {
    first_name: 'Ava',
    last_name: 'ScaleTest',
    job_title: 'Product Manager',
    company_name: 'QA Test Corp',
    coach_id: COACH_ID,
    program: 'SCALE',
    status: 'Active',
    booking_link: 'https://calendly.com/test-coach/scale',
  });

  // Welcome survey — SCALE
  await selectThenUpsertNoId('welcome_survey_scale', 'email', email, {
    coaching_goals:
      'I want to improve my ability to influence cross-functional stakeholders and build stronger executive presence.',
    satisfaction: 7,
    productivity: 6,
    work_life_balance: 5,
    focus_work_relationships: true,
    focus_leadership_development: true,
    focus_inner_confidence: true,
    focus_work_life_balance: false,
    focus_realizing_potential: false,
    focus_work_performance: false,
    focus_work_stress: false,
    focus_new_environment: false,
    focus_adapting_to_change: false,
    focus_dealing_with_uncertainty: false,
    focus_bouncing_back: false,
    focus_relationship_with_self: false,
    focus_positive_habits: false,
    focus_personal_accountability: false,
    focus_professional_development: false,
    focus_persevering_through_change: false,
    focus_relationships_self_others: false,
    focus_coping_stress_anxiety: false,
  });

  // One upcoming session (appointment_number = '1' for milestone detection)
  await upsertSession(email, '1', {
    employee_id: empId,
    employee_name: 'Ava ScaleTest',
    coach_name: COACH_NAME,
    session_date: futureDate.toISOString(),
    status: 'Upcoming',
    company_id: COMPANY_ID,
    program_name: 'SCALE',
  });

  console.log('✓ Persona 3a seeded — SCALE, matched, first session upcoming');
}

// ── 3b  GROW — matched, first session upcoming ──────────────────────────────

async function seedPersona3b() {
  const email = 'qa-persona-3b@boon.test';
  const empId = await ensureEmployee(email, {
    first_name: 'Ben',
    last_name: 'GrowTest',
    job_title: 'Engineering Manager',
    company_name: 'QA Test Corp',
    coach_id: COACH_ID,
    program: 'GROW',
    status: 'Active',
    booking_link: 'https://calendly.com/test-coach/grow',
  });

  // Welcome survey — GROW baseline with competency pre-scores
  await selectThenUpsertNoId('welcome_survey_baseline', 'email', email, {
    coaching_goals:
      'I want to develop my ability to give direct, constructive feedback and build confidence in high-stakes conversations.',
    program_type: 'GROW',
    satisfaction: 4,
    productivity: 3,
    work_life_balance: 3,
    motivation: 4,
    // 12 competency pre-scores (1-5 scale)
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
    // Focus areas — selected 3
    focus_effective_communication: true,
    focus_giving_and_receiving_feedback: true,
    focus_self_confidence_and_imposter_syndrome: true,
    focus_persuasion_and_influence: false,
    focus_adaptability_and_resilience: false,
    focus_strategic_thinking: false,
    focus_emotional_intelligence: false,
    focus_building_relationships_at_work: false,
    focus_delegation_and_accountability: false,
    focus_effective_planning_and_execution: false,
    focus_change_management: false,
    focus_time_management_and_productivity: false,
  });

  // One upcoming session
  await upsertSession(email, '1', {
    employee_id: empId,
    employee_name: 'Ben GrowTest',
    coach_name: COACH_NAME,
    session_date: futureDate.toISOString(),
    status: 'Upcoming',
    company_id: COMPANY_ID,
    program_name: 'GROW',
  });

  console.log('✓ Persona 3b seeded — GROW, matched, first session upcoming');
}

// ── 4a  SCALE — first session completed, survey pending ─────────────────────

async function seedPersona4a() {
  const email = 'qa-persona-4a@boon.test';
  const empId = await ensureEmployee(email, {
    first_name: 'Cara',
    last_name: 'ScalePostFirst',
    job_title: 'Senior Designer',
    company_name: 'QA Test Corp',
    coach_id: COACH_ID,
    program: 'SCALE',
    status: 'Active',
    booking_link: 'https://calendly.com/test-coach/scale',
  });

  // Welcome survey — SCALE
  await selectThenUpsertNoId('welcome_survey_scale', 'email', email, {
    coaching_goals:
      'I want to find better strategies for managing work stress and building resilience.',
    satisfaction: 5,
    productivity: 5,
    work_life_balance: 4,
    focus_work_stress: true,
    focus_bouncing_back: true,
    focus_positive_habits: true,
    focus_work_relationships: false,
    focus_work_life_balance: false,
    focus_leadership_development: false,
    focus_realizing_potential: false,
    focus_work_performance: false,
    focus_new_environment: false,
    focus_adapting_to_change: false,
    focus_dealing_with_uncertainty: false,
    focus_relationship_with_self: false,
    focus_inner_confidence: false,
    focus_personal_accountability: false,
    focus_professional_development: false,
    focus_persevering_through_change: false,
    focus_relationships_self_others: false,
    focus_coping_stress_anxiety: false,
  });

  // Completed first session with goals + plan
  await upsertSession(email, '1', {
    employee_id: empId,
    employee_name: 'Cara ScalePostFirst',
    coach_name: COACH_NAME,
    session_date: pastDate.toISOString(),
    status: 'Completed',
    duration_minutes: 45,
    goals: 'Develop a personal stress management framework and identify early warning signs of burnout.',
    plan: 'Practice the STOP technique (Stop, Take a breath, Observe, Proceed) twice daily.\nSchedule one buffer block per week with no meetings.\nJournal about stress triggers for the next 2 weeks.',
    summary:
      'Great first session exploring the relationship between work stress and productivity. Cara identified several key triggers and we mapped them to specific work situations.',
    company_id: COMPANY_ID,
    program_name: 'SCALE',
  });

  // NOTE: No survey_submissions row → pending_surveys view should trigger scale_feedback

  console.log('✓ Persona 4a seeded — SCALE, first session done, survey pending');
}

// ── 4b  GROW — first session completed, survey pending ──────────────────────

async function seedPersona4b() {
  const email = 'qa-persona-4b@boon.test';
  const empId = await ensureEmployee(email, {
    first_name: 'Dev',
    last_name: 'GrowPostFirst',
    job_title: 'Director of Operations',
    company_name: 'QA Test Corp',
    coach_id: COACH_ID,
    program: 'GROW',
    status: 'Active',
    booking_link: 'https://calendly.com/test-coach/grow',
  });

  // Welcome survey — GROW baseline with competency pre-scores
  await selectThenUpsertNoId('welcome_survey_baseline', 'email', email, {
    coaching_goals:
      'I need to become a stronger strategic thinker and improve my delegation skills so I can focus on higher-level priorities.',
    program_type: 'GROW',
    satisfaction: 3,
    productivity: 3,
    work_life_balance: 2,
    motivation: 4,
    comp_adaptability_and_resilience: 3,
    comp_building_relationships_at_work: 4,
    comp_change_management: 3,
    comp_delegation_and_accountability: 2,
    comp_effective_communication: 3,
    comp_effective_planning_and_execution: 4,
    comp_emotional_intelligence: 3,
    comp_giving_and_receiving_feedback: 3,
    comp_persuasion_and_influence: 3,
    comp_self_confidence_and_imposter_syndrome: 3,
    comp_strategic_thinking: 2,
    comp_time_management_and_productivity: 3,
    focus_strategic_thinking: true,
    focus_delegation_and_accountability: true,
    focus_effective_planning_and_execution: true,
    focus_effective_communication: false,
    focus_persuasion_and_influence: false,
    focus_adaptability_and_resilience: false,
    focus_emotional_intelligence: false,
    focus_building_relationships_at_work: false,
    focus_self_confidence_and_imposter_syndrome: false,
    focus_giving_and_receiving_feedback: false,
    focus_change_management: false,
    focus_time_management_and_productivity: false,
  });

  // Completed first session with goals + plan
  await upsertSession(email, '1', {
    employee_id: empId,
    employee_name: 'Dev GrowPostFirst',
    coach_name: COACH_NAME,
    session_date: pastDate.toISOString(),
    status: 'Completed',
    duration_minutes: 45,
    goals: 'Build a delegation framework and identify 3 tasks to delegate this quarter.',
    plan: 'Complete a task audit: list every recurring task and rate on the delegation matrix.\nIdentify one team member for each delegatable task.\nHave a delegation conversation with your top pick this week.',
    summary:
      'Excellent first session. Dev recognized a strong pattern of holding onto work that others could own. We mapped out a delegation matrix and identified three immediate opportunities.',
    company_id: COMPANY_ID,
    program_name: 'GROW',
  });

  // NOTE: No survey_submissions row → pending_surveys view should trigger grow_first_session

  console.log('✓ Persona 4b seeded — GROW, first session done, survey pending');
}

// ── Run ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Seeding QA data against ${SUPABASE_URL} …\n`);

  await seedCoach();
  await seedPersona3a();
  await seedPersona3b();
  await seedPersona4a();
  await seedPersona4b();

  console.log('\nDone. Test emails:');
  console.log('  3a (SCALE pre-first):  qa-persona-3a@boon.test');
  console.log('  3b (GROW  pre-first):  qa-persona-3b@boon.test');
  console.log('  4a (SCALE post-first): qa-persona-4a@boon.test');
  console.log('  4b (GROW  post-first): qa-persona-4b@boon.test');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
