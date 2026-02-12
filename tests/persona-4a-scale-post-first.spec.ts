/**
 * Persona 4a — SCALE user, first session completed, no upcoming. Survey pending.
 *
 * Expected coaching state: ACTIVE_PROGRAM
 * Component:               ScaleHome
 *
 * Database state:
 *   employee_manager    — coach_id set, program = 'SCALE', status = 'Active'
 *   welcome_survey_scale — row present
 *   session_tracking    — 1 row, status = 'Completed', appointment_number = '1',
 *                          goals + plan populated
 *   survey_submissions  — NONE (this is the key: the pending_surveys view should
 *                          detect session 1 as a SCALE milestone and return
 *                          survey_type = 'scale_feedback')
 *
 * Critical test: the session-1 feedback survey MUST trigger.
 */

import { test, expect } from '@playwright/test';
import { loginAsTestUser, snap, navigateTo, dismissModal } from './helpers';

const EMAIL = 'qa-persona-4a@boon.test';

test.describe('Persona 4a — SCALE, first session done, survey pending', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page, EMAIL);
  });

  // ── Survey trigger ───────────────────────────────────────────────────────

  test('Survey modal triggers on load (scale_feedback for session 1)', async ({ page }) => {
    // App.tsx calls fetchPendingSurvey after data loads.
    // If a pending survey exists it sets showSurveyModal = true and renders
    // <SurveyModal surveyType={pendingSurvey.survey_type} …/>
    await snap(page, '4a-survey-initial');

    // The SurveyModal renders inside a fixed-inset overlay
    const modal = page.locator('.fixed.inset-0').filter({
      hasText: /experience|session|coach|feedback/i,
    });
    const visible = await modal.isVisible().catch(() => false);

    if (!visible) {
      // Try broader selector — any full-screen overlay with survey-ish text
      const alt = page.getByText(/How was your experience/i);
      const altVisible = await alt.isVisible().catch(() => false);

      if (!altVisible) {
        // ▸▸▸ BUG: survey did not trigger ◂◂◂
        await snap(page, '4a-BUG-no-survey-modal');
        console.error(
          'BUG: Survey modal did NOT trigger for SCALE session 1.\n' +
            'Expected: scale_feedback from pending_surveys view for appointment_number=1.\n' +
            'Check: pending_surveys view, fetchPendingSurvey in dataFetcher.ts.',
        );
      }
    } else {
      await snap(page, '4a-survey-modal-visible');
    }

    // Hard assertion — this is the critical pass/fail
    await expect(
      modal.or(page.getByText(/How was your experience/i)),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── Home screen ──────────────────────────────────────────────────────────

  test('Home: greeting and booking CTA (no upcoming session)', async ({ page }) => {
    await dismissModal(page);

    await expect(page.locator('h1')).toContainText('Hi Cara');
    // ScaleHome shows "Ready for your next session?" when no upcoming session
    await expect(
      page.getByText(/Ready for your next session|Book/i),
    ).toBeVisible();
    await snap(page, '4a-home-booking-cta');
  });

  test('Home: goals from session 1 visible', async ({ page }) => {
    await dismissModal(page);

    // ScaleHome / "Where You Left Off" section renders the most recent
    // session's goals and plan
    await expect(
      page.getByText(/stress management framework|burnout/i),
    ).toBeVisible();
    await snap(page, '4a-home-goals');
  });

  test('Home: no "Session X of Y" (SCALE is open-ended)', async ({ page }) => {
    await dismissModal(page);

    // SCALE uses ScaleHome which does NOT render ProgramProgressCard.
    // "Session X of 12" is a GROW-only pattern.
    await expect(page.getByText(/Session \d+ of \d+/)).not.toBeVisible();
  });

  // ── Sessions tab ─────────────────────────────────────────────────────────

  test('Sessions: session 1 shows as completed with expandable details', async ({ page }) => {
    await dismissModal(page);
    await navigateTo(page, 'Sessions');

    await expect(page.getByText('My Sessions')).toBeVisible();
    // Status badge
    await expect(page.getByText('Completed')).toBeVisible();
    // Coach name
    await expect(page.getByText('Darcy Roberts')).toBeVisible();
    await snap(page, '4a-sessions-list');

    // Expand the session card
    const card = page
      .locator('[class*="bg-white"][class*="rounded-2xl"]')
      .filter({ hasText: 'Darcy Roberts' });
    await card.click();
    await page.waitForTimeout(400);

    // Expanded view has Goals, Plan, Summary sections
    await expect(page.getByText('Goals').first()).toBeVisible();
    await expect(page.getByText(/stress management/i)).toBeVisible();
    await expect(page.getByText('Plan').first()).toBeVisible();
    await expect(page.getByText(/STOP technique/i)).toBeVisible();
    await snap(page, '4a-sessions-expanded');

    // "Give Feedback" button present on completed sessions
    await expect(page.getByText('Give Feedback')).toBeVisible();
  });
});
