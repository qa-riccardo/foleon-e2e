import { Page, Locator } from '@playwright/test';

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path: string) {
    await this.page.goto(path);
  }

  async waitForNetworkIdle() {
    await this.page.waitForLoadState('networkidle');
  }

  getByTestId(testId: string): Locator {
    return this.page.getByTestId(testId);
  }
}
