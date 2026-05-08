import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base.page';
import { ToolbarPage } from './toolbar.page';

export class EditorPage extends BasePage {
  readonly toolbar: ToolbarPage;

  readonly canvas = this.page.getByTestId('editor-canvas');
  readonly pageList = this.page.getByTestId('page-list');
  readonly propertiesPanel = this.page.getByTestId('properties-panel');
  readonly selectedElement = this.page.locator('[data-selected="true"]');

  constructor(page: Page) {
    super(page);
    this.toolbar = new ToolbarPage(page);
  }

  async goto(publicationId: string) {
    await super.goto(`/editor/${publicationId}`);
    await this.canvas.waitFor({ state: 'visible' });
  }

  getPage(index: number): Locator {
    return this.pageList.getByTestId('page-thumbnail').nth(index);
  }

  async clickPage(index: number) {
    await this.getPage(index).click();
  }

  async addPage() {
    await this.toolbar.addPageButton.click();
  }

  async deletePage(index: number) {
    const thumb = this.getPage(index);
    await thumb.click({ button: 'right' });
    await this.page.getByRole('menuitem', { name: /delete page/i }).click();
  }

  async clickOnCanvas(x: number, y: number) {
    await this.canvas.click({ position: { x, y } });
  }

  async dragElementOnCanvas(fromX: number, fromY: number, toX: number, toY: number) {
    await this.canvas.dragTo(this.canvas, {
      sourcePosition: { x: fromX, y: fromY },
      targetPosition: { x: toX, y: toY },
    });
  }

  async expectPageCount(count: number) {
    await expect(this.pageList.getByTestId('page-thumbnail')).toHaveCount(count);
  }

  async expectElementSelected() {
    await expect(this.selectedElement).toBeVisible();
  }
}
