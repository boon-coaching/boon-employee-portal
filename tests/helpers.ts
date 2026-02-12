import type { Page } from '@playwright/test';

/**
 * Authenticate as a test user via the dev-mode bypass in AuthContext.
 *
 * AuthContext checks for `boon_dev_email` in localStorage on mount. When
 * present it calls `fetchEmployeeProfileDevMode(email)` which queries
 * employee_manager directly with the anon key and creates a mock session.
 */
export async function loginAsTestUser(page: Page, email: string) {
  // Go to login first so we have a page origin for localStorage
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  // Inject the dev-mode email
  await page.evaluate((e: string) => {
    localStorage.setItem('boon_dev_email', e);
  }, email);

  // Navigate to the protected root — AuthProvider picks up the email
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Wait for the data-loading spinner ("Getting your dashboard ready…") to vanish.
  // This means employee + sessions + surveys have all loaded.
  await page.waitForFunction(
    () => !document.body.textContent?.includes('Getting your dashboard ready'),
    { timeout: 20_000 },
  );

  // Extra settle for any post-load state updates (survey modal, etc.)
  await page.waitForTimeout(1000);
}

/**
 * Take a full-page screenshot into test-results/<name>.png.
 */
export async function snap(page: Page, name: string) {
  await page.screenshot({
    path: `test-results/${name}.png`,
    fullPage: true,
  });
}

/**
 * Navigate via the Layout sidebar / bottom-bar buttons.
 *
 * The Layout component renders nav items with labels:
 *   Home | Sessions (or Archive) | Progress (or Profile) | Practice
 */
export async function navigateTo(
  page: Page,
  label: 'Home' | 'Sessions' | 'Progress' | 'Practice' | 'Archive' | 'Profile',
) {
  // On desktop the sidebar renders <button> elements; on mobile a bottom bar.
  // Both use the same label text.
  const btn = page.locator('button').filter({ hasText: new RegExp(`^${label}$`, 'i') });
  await btn.first().click();
  // Let the new view render
  await page.waitForTimeout(600);
}

/**
 * Try to dismiss a modal overlay (survey, checkpoint, etc.).
 * Returns true if something was dismissed.
 */
export async function dismissModal(page: Page): Promise<boolean> {
  // Try a close / skip / later button
  for (const text of ['close', 'skip', 'later', 'dismiss', 'not now', '×']) {
    const btn = page.locator('button').filter({ hasText: new RegExp(text, 'i') });
    if (await btn.first().isVisible({ timeout: 300 }).catch(() => false)) {
      await btn.first().click();
      await page.waitForTimeout(400);
      return true;
    }
  }

  // Try clicking the backdrop (the dark overlay behind a modal)
  const backdrop = page.locator('.fixed.inset-0 .absolute.inset-0, [class*="backdrop"]');
  if (await backdrop.first().isVisible({ timeout: 300 }).catch(() => false)) {
    await backdrop.first().click({ position: { x: 5, y: 5 }, force: true });
    await page.waitForTimeout(400);
    return true;
  }

  return false;
}
