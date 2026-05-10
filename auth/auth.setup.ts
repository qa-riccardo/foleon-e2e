import { test as setup, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';

const AUTH_FILE = '.auth/user.json';

setup('Authenticate', async ({ page }) => {
  const email = process.env.USER_EMAIL;
  const password = process.env.USER_PASSWORD;

  if (!email || !password) {
    throw new Error('USER_EMAIL and USER_PASSWORD must be set in .env');
  }

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(email, password);

  await expect(page).not.toHaveURL(/login/, { timeout: 15_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
