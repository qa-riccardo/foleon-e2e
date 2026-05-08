import { test, expect } from '../../fixtures';

const PUBLICATION_NAME = `E2E Test Publication ${Date.now()}`;

test.describe('Create Publication', () => {
  test.afterEach(async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.deletePublication(PUBLICATION_NAME).catch(() => {});
  });

  test('creates a new publication from dashboard', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();
    await dashboardPage.createPublication(PUBLICATION_NAME);

    await expect(page).toHaveURL(/editor/, { timeout: 20_000 });
  });

  test('new publication appears in dashboard list', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.createPublication(PUBLICATION_NAME);
    await dashboardPage.goto();
    await dashboardPage.expectPublicationVisible(PUBLICATION_NAME);
  });

  test('can delete a publication', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.createPublication(PUBLICATION_NAME);
    await dashboardPage.goto();
    await dashboardPage.deletePublication(PUBLICATION_NAME);

    await expect(
      dashboardPage.publicationCards.filter({ hasText: PUBLICATION_NAME })
    ).toHaveCount(0);
  });
});
