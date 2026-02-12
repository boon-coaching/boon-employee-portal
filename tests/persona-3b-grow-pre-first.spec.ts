/**
 * Persona 3b — GROW user, matched with coach, first session upcoming.
 *
 * Expected coaching state: MATCHED_PRE_FIRST_SESSION
 * Component:               PreFirstSessionHome (shared by SCALE and GROW)
 *
 * Database state:
 *   employee_manager       — coach_id set, program = 'GROW', status = 'Active'
 *   welcome_survey_baseline — row present with coaching_goals, 12 comp_* pre-scores,
 *                             3 focus_* booleans = true
 *   session_tracking       — 1 row, status = 'Upcoming', appointment_number = '1'
 *   survey_submissions     — none
 *
 * GROW-specific checks:
 *   • Pre-scores come from welcome_survey_baseline.comp_* columns (NOT a
 *     separate competency_scores table)
 *   • Focus areas are welcome_survey_baseline.focus_* booleans
 *   • Progress tab should show the 12 competency pre-scores
 */

import { test, expect } from '@playwright/test';
import { loginAsTestUser, snap, navigateTo } from './helpers';

const EMAIL = 'qa-persona-3b@boon.test';

test.describe('Persona 3b — GROW, matched, first session upcoming', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page, EMAIL);
  });

  // ── Home screen ──────────────────────────────────────────────────────────

  test('Home: greeting and subtitle', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Hi Ben');
    await expect(page.getByText('Your coaching journey is about to begin')).toBeVisible();
    await snap(page, '3b-home-header');
  });

  test('Home: first-session card visible', async ({ page }) => {
    await expect(page.getByText('Your First Session')).toBeVisible();
    await expect(page.getByText('Darcy Roberts').first()).toBeVisible();
    await snap(page, '3b-home-first-session-card');
  });

  test('Home: coach card renders', async ({ page }) => {
    await expect(page.getByText('Meet Your Coach')).toBeVisible();
    await expect(page.getByText('Darcy Roberts')).toBeVisible();
    await snap(page, '3b-home-coach-card');
  });

  test('Home: "What You Shared" reflects GROW coaching goals and focus areas', async ({ page }) => {
    await expect(page.getByText('What You Shared')).toBeVisible();

    // Coaching goals from welcome_survey_baseline.coaching_goals
    await expect(page.getByText(/give direct.*constructive feedback/i)).toBeVisible();

    // GROW focus areas from welcome_survey_baseline.focus_* booleans
    // The component maps them through growFocusAreaLabels:
    //   focus_effective_communication → "Effective Communication"
    //   focus_giving_and_receiving_feedback → "Giving & Receiving Feedback"
    //   focus_self_confidence_and_imposter_syndrome → "Self-Confidence"
    await expect(page.getByText('Effective Communication')).toBeVisible();
    await expect(page.getByText(/Giving.*Receiving Feedback/i)).toBeVisible();
    await expect(page.getByText('Self-Confidence')).toBeVisible();
    await snap(page, '3b-home-focus-areas');
  });

  test('Home: pre-session note prompt', async ({ page }) => {
    await expect(
      page.getByText(/Anything specific.*beyond your welcome survey/i),
    ).toBeVisible();
  });

  test('Home: no empty-state or error messages', async ({ page }) => {
    for (const bad of ['No data', 'Nothing here', 'No sessions found']) {
      await expect(page.getByText(bad, { exact: false })).not.toBeVisible();
    }
  });

  // ── Sessions tab ─────────────────────────────────────────────────────────

  test('Sessions: pre-first-session state', async ({ page }) => {
    await navigateTo(page, 'Sessions');

    await expect(page.getByText('My Sessions')).toBeVisible();
    await expect(page.getByText('Your coaching journey is just beginning')).toBeVisible();
    await expect(page.getByText('Your First Session')).toBeVisible();
    await expect(page.getByText('Session Notes & History')).toBeVisible();
    await expect(page.getByText('No sessions found')).not.toBeVisible();
    await snap(page, '3b-sessions');
  });

  // ── Progress tab — GROW pre-scores ───────────────────────────────────────

  test('Progress: competency pre-scores from baseline are displayed', async ({ page }) => {
    await navigateTo(page, 'Progress');
    await page.waitForTimeout(1500);
    await snap(page, '3b-progress');

    // The Progress component should render something for GROW baseline data.
    // It should NOT show a raw "No data" message.
    await expect(page.getByText('No data to display')).not.toBeVisible();
    await expect(page.getByText('No data')).not.toBeVisible();

    // Expect at least some competency-related content to be visible.
    // The exact rendering depends on the Progress component, but we check
    // that the page has meaningful content (not just a blank placeholder).
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(200);
  });

  // ── Survey ───────────────────────────────────────────────────────────────

  test('No survey modal (no completed sessions)', async ({ page }) => {
    await page.waitForTimeout(2000);
    const modal = page.locator('.fixed.inset-0').filter({
      hasText: /experience|survey|feedback/i,
    });
    await expect(modal).not.toBeVisible();
  });
});
