import { test, expect } from '../../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login', () => {
  test('redirects unauthenticated users to login page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/login/);
  });

  test('logs in with valid credentials', async ({ loginPage, page }) => {
    const email = process.env.USER_EMAIL!;
    const password = process.env.USER_PASSWORD!;

    await loginPage.goto();
    await loginPage.login(email, password);

    await expect(page).toHaveURL(/dashboard|home|\/$/, { timeout: 15_000 });
  });

  test('shows error on invalid credentials', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login('wrong@foleon.com', 'wrongpassword');
    await loginPage.expectError();
  });

  test('shows error on empty submission', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.submitButton.click();
    await expect(page.getByRole('alert').or(page.locator('[aria-invalid="true"]'))).toBeVisible();
  });
});
