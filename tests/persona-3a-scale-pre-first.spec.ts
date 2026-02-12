/**
 * Persona 3a — SCALE user, matched with coach, first session upcoming.
 *
 * Expected coaching state: MATCHED_PRE_FIRST_SESSION
 * Component:               PreFirstSessionHome (shared by SCALE and GROW)
 *
 * Database state:
 *   employee_manager  — coach_id set, program = 'SCALE', status = 'Active'
 *   welcome_survey_scale — row present with coaching_goals + 3 focus_* = true
 *   session_tracking  — 1 row, status = 'Upcoming', appointment_number = '1'
 *   survey_submissions — none
 */

import { test, expect } from '@playwright/test';
import { loginAsTestUser, snap, navigateTo } from './helpers';

const EMAIL = 'qa-persona-3a@boon.test';

test.describe('Persona 3a — SCALE, matched, first session upcoming', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page, EMAIL);
  });

  // ── Home screen ──────────────────────────────────────────────────────────

  test('Home: greeting and subtitle', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Hi Ava');
    await expect(page.getByText('Your coaching journey is about to begin')).toBeVisible();
    await snap(page, '3a-home-header');
  });

  test('Home: first-session card shows date and coach name', async ({ page }) => {
    // PreFirstSessionHome renders a card with label "Your First Session"
    await expect(page.getByText('Your First Session')).toBeVisible();
    // Coach name appears inside the card ("… with Darcy Roberts")
    await expect(page.getByText('Darcy Roberts').first()).toBeVisible();
    await snap(page, '3a-home-first-session-card');
  });

  test('Home: coach card with name, headline, credentials', async ({ page }) => {
    await expect(page.getByText('Meet Your Coach')).toBeVisible();
    await expect(page.getByText('Darcy Roberts')).toBeVisible();
    // Coach headline from coaches table
    await expect(page.getByText('Former VP at Google, Microsoft')).toBeVisible();
    // Coach credentials
    await expect(page.getByText(/ICF PCC/)).toBeVisible();
    await snap(page, '3a-home-coach-card');
  });

  test('Home: "What You Shared" reflects coaching goals and SCALE focus areas', async ({ page }) => {
    await expect(page.getByText('What You Shared')).toBeVisible();
    // Coaching goals
    await expect(page.getByText(/influence cross-functional/i)).toBeVisible();
    // SCALE focus areas (from welcome_survey_scale.focus_* booleans)
    await expect(page.getByText('Work Relationships')).toBeVisible();
    await expect(page.getByText('Leadership Development')).toBeVisible();
    await expect(page.getByText('Inner Confidence')).toBeVisible();
    await snap(page, '3a-home-what-you-shared');
  });

  test('Home: pre-session note prompt visible', async ({ page }) => {
    // PreFirstSessionHome always shows the pre-session note textarea
    await expect(
      page.getByText(/Anything specific.*beyond your welcome survey/i),
    ).toBeVisible();
    await snap(page, '3a-home-pre-session-note');
  });

  test('Home: no empty-state or error messages', async ({ page }) => {
    for (const bad of ['No data', 'Nothing here', 'No sessions found', 'error']) {
      await expect(page.getByText(bad, { exact: false })).not.toBeVisible();
    }
  });

  // ── Sessions tab ─────────────────────────────────────────────────────────

  test('Sessions: pre-first-session state with upcoming card and intentional empty', async ({ page }) => {
    await navigateTo(page, 'Sessions');

    // Heading
    await expect(page.getByText('My Sessions')).toBeVisible();
    await expect(page.getByText('Your coaching journey is just beginning')).toBeVisible();

    // Upcoming first session card
    await expect(page.getByText('Your First Session')).toBeVisible();
    await expect(page.getByText('Darcy Roberts')).toBeVisible();

    // Intentional empty state — no raw "No sessions found"
    await expect(page.getByText('Session Notes & History')).toBeVisible();
    await expect(
      page.getByText(/After your first session.*notes.*reflections/i),
    ).toBeVisible();
    await expect(page.getByText('No sessions found')).not.toBeVisible();
    await snap(page, '3a-sessions');
  });

  // ── Survey ───────────────────────────────────────────────────────────────

  test('No survey modal (no completed sessions yet)', async ({ page }) => {
    // SurveyModal is only shown when fetchPendingSurvey returns a result,
    // which requires a completed session at a milestone number.
    await page.waitForTimeout(2000);
    // The modal renders inside a fixed-inset overlay
    const modal = page.locator('.fixed.inset-0').filter({
      hasText: /experience|survey|feedback/i,
    });
    await expect(modal).not.toBeVisible();
  });
});
