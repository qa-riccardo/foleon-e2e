import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class LoginPage extends BasePage {
  readonly emailInput = this.page.getByRole('textbox', { name: 'Email address' });
  readonly passwordInput = this.page.getByRole('textbox', { name: 'Password' });
  readonly submitButton = this.page.getByRole('button', { name: 'Login' });
  readonly errorMessage = this.page.getByRole('alert');

  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await super.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message?: string) {
    await expect(this.errorMessage).toBeVisible();
    if (message) await expect(this.errorMessage).toContainText(message);
  }
}
