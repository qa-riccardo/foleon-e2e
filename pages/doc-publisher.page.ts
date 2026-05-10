import { Page } from '@playwright/test';
import { BasePage } from './base.page';

export class DocPublisherPage extends BasePage {
  readonly canvas = this.page.getByTestId('editor-next_magazine-page_component');

  constructor(page: Page) {
    super(page);
  }

  async gotoEditor(url: string) {
    await this.page.goto(url);
    await this.canvas.waitFor({ state: 'visible' });
  }

  async editFirstTextElement(text: string) {
    const textEl = this.canvas
      .locator('[data-testid^="ripley-core__text-item__"]')
      .first();
    await textEl.click();
    await textEl.dblclick();
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.type(text);
  }

  async publish() {
    await this.page.getByRole('button', { name: /^publish$/i }).click();
    const confirmBtn = this.page.getByRole('button', { name: /confirm|publish now/i });
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }
  }
}
