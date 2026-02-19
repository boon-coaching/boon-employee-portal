/**
 * Preview mode screenshot capture.
 *
 * Usage:
 *   VITE_PREVIEW_MODE=true npm run dev
 *   PREVIEW_EMAIL=canderson@boon-health.com npx playwright test tests/preview-screenshot.spec.ts
 *
 * Requires the dev server running with VITE_PREVIEW_MODE=true.
 */

import { test } from '@playwright/test';
import { snap, navigateTo } from './helpers';

const email = process.env.PREVIEW_EMAIL || 'canderson@boon-health.com';
const slug = email.split('@')[0];

test.describe(`Preview screenshots for ${email}`, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/?email=${encodeURIComponent(email)}`, {
      waitUntil: 'domcontentloaded',
    });

    // Wait for data loading to finish
    await page.waitForFunction(
      () =>
        !document.body.textContent?.includes('Getting your dashboard ready') &&
        !document.body.textContent?.includes('Loading...'),
      { timeout: 20_000 },
    );

    await page.waitForTimeout(1000);
  });

  test('Dashboard', async ({ page }) => {
    await snap(page, `${slug}-dashboard`);
  });

  test('Sessions', async ({ page }) => {
    await navigateTo(page, 'Sessions');
    await snap(page, `${slug}-sessions`);
  });

  test('Progress', async ({ page }) => {
    await navigateTo(page, 'Progress');
    await snap(page, `${slug}-progress`);
  });

  test('Practice', async ({ page }) => {
    await navigateTo(page, 'Practice');
    await snap(page, `${slug}-practice`);
  });
});
