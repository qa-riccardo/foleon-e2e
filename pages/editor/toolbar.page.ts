import { Page } from '@playwright/test';
import { BasePage } from '../base.page';

export type ElementType = 'text' | 'image' | 'shape' | 'video' | 'button';

export class ToolbarPage extends BasePage {
  readonly addPageButton = this.page.getByRole('button', { name: /add page/i });
  readonly undoButton = this.page.getByRole('button', { name: /undo/i });
  readonly redoButton = this.page.getByRole('button', { name: /redo/i });
  readonly publishButton = this.page.getByRole('button', { name: /publish/i });
  readonly previewButton = this.page.getByRole('button', { name: /preview/i });
  readonly saveIndicator = this.page.getByTestId('save-indicator');

  constructor(page: Page) {
    super(page);
  }

  async addElement(type: ElementType) {
    await this.page.getByRole('button', { name: new RegExp(type, 'i') }).click();
  }

  async undo() {
    await this.undoButton.click();
  }

  async redo() {
    await this.redoButton.click();
  }

  async publish() {
    await this.publishButton.click();
    await this.page.getByRole('button', { name: /confirm|publish now/i }).click();
  }
}
