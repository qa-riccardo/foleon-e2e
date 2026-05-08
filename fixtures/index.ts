import { test as base, Page } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { EditorPage } from '../pages/editor/editor.page';
import { BrandKitPage } from '../pages/brand-kit.page';

type FoleonFixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  editorPage: EditorPage;
  brandKitPage: BrandKitPage;
};

export const test = base.extend<FoleonFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  editorPage: async ({ page }, use) => {
    await use(new EditorPage(page));
  },

  brandKitPage: async ({ page }, use) => {
    await use(new BrandKitPage(page));
  },
});

export { expect } from '@playwright/test';
