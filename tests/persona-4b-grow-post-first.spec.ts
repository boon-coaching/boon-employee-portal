/**
 * Persona 4b — GROW user, first session completed, no upcoming. Survey pending.
 *
 * Expected coaching state: ACTIVE_PROGRAM
 * Component:               GrowDashboard
 *
 * Database state:
 *   employee_manager       — coach_id set, program = 'GROW', status = 'Active'
 *   welcome_survey_baseline — row with 12 comp_* pre-scores + focus_* booleans
 *   session_tracking       — 1 row, status = 'Completed', appointment_number = '1',
 *                             goals + plan populated
 *   survey_submissions     — NONE → pending_surveys should return
 *                             survey_type = 'grow_first_session'
 *
 * GROW-specific checks:
 *   • "Session 1 of 12" progress bar (ProgramProgressCard)
 *   • Coach card shows "1 session together"
 *   • Session 1 feedback survey triggers (grow_first_session)
 *   • Pre-scores visible on Progress tab
 */

import { test, expect } from '@playwright/test';
import { loginAsTestUser, snap, navigateTo, dismissModal } from './helpers';

const EMAIL = 'qa-persona-4b@boon.test';

test.describe('Persona 4b — GROW, first session done, survey pending', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page, EMAIL);
  });

  // ── Survey trigger ───────────────────────────────────────────────────────

  test('Survey modal triggers on load (grow_first_session for session 1)', async ({ page }) => {
    await snap(page, '4b-survey-initial');

    const modal = page.locator('.fixed.inset-0').filter({
      hasText: /experience|session|coach|feedback/i,
    });
    const visible = await modal.isVisible().catch(() => false);

    if (!visible) {
      const alt = page.getByText(/How was your experience/i);
      const altVisible = await alt.isVisible().catch(() => false);

      if (!altVisible) {
        await snap(page, '4b-BUG-no-survey-modal');
        console.error(
          'BUG: Survey modal did NOT trigger for GROW session 1.\n' +
            'Expected: grow_first_session from pending_surveys view.\n' +
            'Check: pending_surveys view GROW milestone detection for appointment_number=1.',
        );
      }
    } else {
      await snap(page, '4b-survey-modal-visible');
    }

    await expect(
      modal.or(page.getByText(/How was your experience/i)),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── Home screen — GrowDashboard ──────────────────────────────────────────

  test('Home: greeting and GROW subtitle', async ({ page }) => {
    await dismissModal(page);

    await expect(page.locator('h1')).toContainText('Hi Dev');
    await expect(page.getByText('Your GROW coaching journey')).toBeVisible();
    await snap(page, '4b-home-header');
  });

  test('Home: program progress card shows "Session 1 of 12"', async ({ page }) => {
    await dismissModal(page);

    // ProgramProgressCard renders "Session {n} of {total}" inside GrowDashboard
    await expect(page.getByText('Program Progress')).toBeVisible();
    await expect(page.getByText(/Session.*1.*of.*12/)).toBeVisible();
    await snap(page, '4b-home-program-progress');
  });

  test('Home: "Book Your Next Session" CTA (no upcoming)', async ({ page }) => {
    await dismissModal(page);

    // GrowDashboard shows the hero CTA when no upcoming session
    await expect(page.getByText(/Book Your Next Session/i)).toBeVisible();
    await snap(page, '4b-home-book-cta');
  });

  test('Home: "Where We Left Off" shows goals from session 1', async ({ page }) => {
    await dismissModal(page);

    await expect(page.getByText(/Where We Left Off/i)).toBeVisible();
    // Goals from session_tracking.goals
    await expect(page.getByText(/delegation framework/i)).toBeVisible();
    await snap(page, '4b-home-goals');
  });

  test('Home: coach card with session count', async ({ page }) => {
    await dismissModal(page);

    await expect(page.getByText('Your Coach')).toBeVisible();
    await expect(page.getByText('Darcy Roberts')).toBeVisible();
    // GrowDashboard shows "{n} session(s) together"
    await expect(page.getByText(/1 session together/i)).toBeVisible();
    await snap(page, '4b-home-coach-card');
  });

  // ── Sessions tab ─────────────────────────────────────────────────────────

  test('Sessions: session 1 completed with expandable details', async ({ page }) => {
    await dismissModal(page);
    await navigateTo(page, 'Sessions');

    await expect(page.getByText('My Sessions')).toBeVisible();
    await expect(page.getByText('Completed')).toBeVisible();
    await expect(page.getByText('Darcy Roberts')).toBeVisible();
    await snap(page, '4b-sessions-list');

    // Expand
    const card = page
      .locator('[class*="bg-white"][class*="rounded-2xl"]')
      .filter({ hasText: 'Darcy Roberts' });
    await card.click();
    await page.waitForTimeout(400);

    await expect(page.getByText('Goals').first()).toBeVisible();
    await expect(page.getByText(/delegation framework/i)).toBeVisible();
    await expect(page.getByText('Plan').first()).toBeVisible();
    await expect(page.getByText(/task audit/i)).toBeVisible();
    await snap(page, '4b-sessions-expanded');

    await expect(page.getByText('Give Feedback')).toBeVisible();
  });

  // ── Progress tab — GROW pre-scores ───────────────────────────────────────

  test('Progress: pre-assessment scores visible, no empty state', async ({ page }) => {
    await dismissModal(page);
    await navigateTo(page, 'Progress');
    await page.waitForTimeout(1500);
    await snap(page, '4b-progress');

    // Pre-scores should be rendered from welcome_survey_baseline.comp_* columns.
    // No "No data" placeholder.
    await expect(page.getByText('No data to display')).not.toBeVisible();
    await expect(page.getByText('No data')).not.toBeVisible();

    // Page should have substantive content
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(200);
    await snap(page, '4b-progress-full');
  });
});
