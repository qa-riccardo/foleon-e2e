import { test, expect } from '../../fixtures';
import { DashboardPage } from '../../pages/dashboard.page';

const PUBLICATION_NAME = `E2E Canvas Test ${Date.now()}`;
let publicationId: string;

test.describe('Editor Canvas', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.createPublication(PUBLICATION_NAME);

    const url = new URL(page.url());
    publicationId = url.pathname.split('/').find(segment => /^\d+$/.test(segment)) ?? '';
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.deletePublication(PUBLICATION_NAME).catch(() => {});
    await page.close();
  });

  test('editor loads with a canvas', async ({ editorPage }) => {
    await editorPage.goto(publicationId);
    await expect(editorPage.canvas).toBeVisible();
  });

  test('starts with one page', async ({ editorPage }) => {
    await editorPage.goto(publicationId);
    await editorPage.expectPageCount(1);
  });

  test('can add a new page', async ({ editorPage }) => {
    await editorPage.goto(publicationId);
    await editorPage.addPage();
    await editorPage.expectPageCount(2);
  });

  test('can add a text element to the canvas', async ({ editorPage }) => {
    await editorPage.goto(publicationId);
    await editorPage.toolbar.addElement('text');
    await editorPage.expectElementSelected();
  });

  test('can add an image element to the canvas', async ({ editorPage }) => {
    await editorPage.goto(publicationId);
    await editorPage.toolbar.addElement('image');
    await expect(editorPage.page.getByRole('dialog').or(editorPage.selectedElement)).toBeVisible();
  });

  test('undo removes last action', async ({ editorPage }) => {
    await editorPage.goto(publicationId);
    const initialCount = await editorPage.pageList.getByTestId('page-thumbnail').count();
    await editorPage.addPage();
    await editorPage.expectPageCount(initialCount + 1);
    await editorPage.toolbar.undo();
    await editorPage.expectPageCount(initialCount);
  });

  test('properties panel appears when element is selected', async ({ editorPage }) => {
    await editorPage.goto(publicationId);
    await editorPage.toolbar.addElement('text');
    await expect(editorPage.propertiesPanel).toBeVisible();
  });
});
