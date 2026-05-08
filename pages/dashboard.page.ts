import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class DashboardPage extends BasePage {
  readonly createButton = this.page.getByRole('button', { name: /create|new publication/i });
  readonly searchInput = this.page.getByPlaceholder(/search/i);
  readonly publicationCards = this.page.locator('[data-testid="publication-card"]');
  readonly emptyState = this.page.getByTestId('empty-state');

  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await super.goto('/');
    await this.waitForNetworkIdle();
  }

  async createPublication(name: string) {
    await this.createButton.click();
    const nameInput = this.page.getByLabel(/publication name|title/i);
    await nameInput.fill(name);
    await this.page.getByRole('button', { name: /create|confirm/i }).click();
  }

  async openPublication(name: string) {
    await this.publicationCards.filter({ hasText: name }).first().click();
  }

  async deletePublication(name: string) {
    const card = this.publicationCards.filter({ hasText: name }).first();
    await card.hover();
    await card.getByRole('button', { name: /more|options|menu/i }).click();
    await this.page.getByRole('menuitem', { name: /delete/i }).click();
    await this.page.getByRole('button', { name: /confirm|delete/i }).click();
  }

  async searchFor(term: string) {
    await this.searchInput.fill(term);
    await this.waitForNetworkIdle();
  }

  async expectPublicationVisible(name: string) {
    await expect(this.publicationCards.filter({ hasText: name })).toBeVisible();
  }
}
