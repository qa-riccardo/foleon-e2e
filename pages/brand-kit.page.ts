import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export type ThemeTab = 'navigation' | 'content' | 'charts';
export type TypographyStyle = 'Header 1' | 'Header 2' | 'Header 3' | 'Body' | 'Caption';

// Light blue: #ADD8E6 = rgb(173, 216, 230)
const LIGHT_BLUE_HEX = 'ADD8E6';
const LIGHT_BLUE_RGB = 'rgb(173, 216, 230)';

// Light green: #90EE90 = rgb(144, 238, 144)
const LIGHT_GREEN_HEX = '90EE90';
const LIGHT_GREEN_RGB = 'rgb(144, 238, 144)';

// Dark orange: #FF8C00 = rgb(255, 140, 0)
const DARK_ORANGE_HEX = 'FF8C00';
const DARK_ORANGE_RGB = 'rgb(255, 140, 0)';

// Dark grey: #333333 = rgb(51, 51, 51)
const DARK_GREY_HEX = '333333';

// Yellow: #FFD700 = rgb(255, 215, 0)
const YELLOW_HEX = 'FFD700';
const YELLOW_RGB = 'rgb(255, 215, 0)';

export class BrandKitPage extends BasePage {
  // Brand Kit list (dashboard level)
  readonly createButton = this.page.getByRole('button', { name: 'Start new Brand Kit' }).first();
  readonly brandKitNavButton = this.page.getByRole('button', { name: 'Brand Kits' });

  // Theme tabs (right panel)
  readonly tabBasics = this.page.getByRole('button', { name: 'Basics' });
  readonly tabNavigation = this.page.getByRole('button', { name: 'Navigation' });
  readonly tabContent = this.page.getByRole('button', { name: 'Content' });
  readonly tabCharts = this.page.getByRole('button', { name: 'Charts' });

  // Solid color swatches (Basics tab, Colors > Solid section)
  readonly firstSolidSwatch = this.page
    .getByTestId('core-editor_settings-panel_color-picker_open-color-picker-button')
    .first();

  // Page Background is always the last (and only) swatch in its section
  readonly pageBackgroundSwatch = this.page
    .getByTestId('core-editor_settings-panel_color-picker_open-color-picker-button')
    .last();

  // Canvas page element — background-color reflects the active page background setting
  readonly canvasPage = this.page.getByTestId('editor-next_magazine-page_component');

  // Color picker — R/G/B/A are type="number"; hex is the only type="text" input in the picker
  readonly colorSpectrum = this.page.locator('#spectrum');
  readonly colorPickerHexInput = this.page.locator('#spectrum')
    .locator('xpath=ancestor::div[5]')
    .locator('input[type="text"]')
    .first();

  // Navigation tab — logos
  readonly navigationLogoThumbnail = this.page
    .getByTestId('core-editor__theme__logo__container')
    .first();
  readonly canvasLogoImage = this.page.getByTestId('foleon-logo-image');

  // Content tab — color mode add button
  readonly addModeButton = this.page.getByTestId('theme-mode-add-button');

  // Content tab — background color swatch (works for both Mode 1 and Mode 2, scoped to active mode)
  readonly contentBackgroundSwatch = this.page
    .getByTestId('theme-mode-background-swatch')
    .getByTestId('core-editor_settings-panel_color-picker_open-color-picker-button');

  // Charts tab — chart background swatch
  readonly chartBackgroundSwatch = this.page
    .getByTestId('chart-color-background')
    .getByTestId('core-editor_settings-panel_color-picker_open-color-picker-button');

  // Content tab — typography
  readonly typographyPanel = this.page.getByTestId('core-editor__theme__theme-typography');
  // Header 1 row in the panel typography preview (clicking it activates the RTE toolbar)
  readonly panelHeader1 = this.page
    .getByTestId('core-editor__theme__theme-typography')
    .getByTestId('ripley-core__text-item__header-one__component');
  // Styled heading inside the panel preview — reflects the current H1 font and color
  readonly panelHeader1Heading = this.page
    .getByTestId('core-editor__theme__theme-typography')
    .getByRole('heading', { name: 'Header 1', level: 1 });
  // Canvas H1 element ("Satatium voloration…")
  readonly canvasHeader1 = this.page
    .getByTestId('editor-next_magazine-page_component')
    .getByTestId('ripley-core__text-item__header-one__component');

  // RTE toolbar (visible when a typography style is selected)
  readonly rteFontFamily = this.page.getByTestId('core-editor_RTE_font-family');
  readonly fontColorPicker = this.page.getByTestId('core-editor_RTE_font-color');

  // Save flow
  readonly saveButton = this.page.getByRole('button', { name: 'Save' });
  readonly modal = this.page.getByTestId('modal-container');
  readonly modalNameInput = this.page.getByTestId('modal-container').getByRole('textbox');
  readonly modalSaveButton = this.page.getByTestId('modal-container').getByRole('button', { name: 'Save' });

  // Left-panel project navigation (shown after saving a Brand Kit)
  readonly projectNavItem = this.page.getByRole('link', { name: 'Projects' });

  // Project list — "Start new Foleon Doc" button (top-right corner of project view)
  readonly startNewFoleonDocButton = this.page.getByRole('button', { name: 'Start new Foleon Doc' }).first();

  // New Foleon Doc page (full-page form, not a dialog)
  readonly foleonDocNameInput = this.page.getByPlaceholder('Type a name');
  readonly confirmFoleonDocButton = this.page.getByRole('toolbar').getByRole('button', { name: 'Start new Foleon Doc' });

  // Page-creation modals (two-step wizard inside the editor)
  // Step 1 — "Create new page": name input and submit button (modal-container)
  // Step 2 — "Choose a page template": template tile and confirm button (same modal-container testid)
  readonly pageNameInput = this.page.getByTestId('modal-container').getByRole('textbox');
  readonly createPageButton = this.page.getByTestId('modal-container').getByRole('button', { name: 'Create page' });
  readonly startFromScratchTile = this.page.getByTestId('tile-item').filter({ hasText: 'Start from scratch' });

  // Doc Editor left-panel elements
  readonly elementsTabButton = this.page.getByTestId('add-content-tab-Elements');
  readonly titleElementCard = this.page.getByTestId('sidebar-element-content-title');

  // Doc Editor / Preview shared selectors (same testids in both contexts)
  readonly docCanvasSection = this.page.getByTestId('@foleon/maggie-viewer_section-component');
  readonly previewButton = this.page.getByTestId('button-preview');

  // Left-panel workspace-level nav links, scoped to /workspace/ path to avoid Brand Console duplicates
  readonly templatesNavItem = this.page.locator('a[href*="/workspace/"][href$="/template"]');
  readonly modulesNavItem = this.page.locator('a[href*="/workspace/"][href$="/module"]');

  constructor(page: Page) {
    super(page);
  }

  async navigateToBrandKits() {
    await super.goto('/');
    await this.brandKitNavButton.click();
    await this.createButton.waitFor({ state: 'visible' });
  }

  async openSwatchColorPicker(swatch: Locator) {
    await swatch.waitFor({ state: 'visible' });
    await swatch.click();
    await this.colorSpectrum.waitFor({ state: 'visible' });
  }

  async openFirstSolidSwatchColorPicker() {
    await this.openSwatchColorPicker(this.firstSolidSwatch);
  }

  async openPageBackgroundColorPicker() {
    await this.openSwatchColorPicker(this.pageBackgroundSwatch);
  }

  async addNewMode() {
    await this.addModeButton.click();
  }

  async openContentBackgroundColorPicker() {
    await this.openSwatchColorPicker(this.contentBackgroundSwatch);
  }

  async openChartBackgroundColorPicker() {
    await this.openSwatchColorPicker(this.chartBackgroundSwatch);
  }

  async dismissRTE() {
    await this.page.mouse.click(400, 25);
  }

  async setColorViaHexInput(hex: string) {
    // pressSequentially triggers React's synthetic input events; fill() alone does not.
    // No Enter — Enter closes the picker prematurely and Escape would then close the panel.
    await this.colorPickerHexInput.waitFor({ state: 'visible' });
    await this.colorPickerHexInput.click({ clickCount: 3 });
    await this.colorPickerHexInput.pressSequentially(hex);
  }

  async setColorToRedViaSpectrum() {
    // Top-right of spectrum = max saturation, max brightness at current hue -> near-pure red
    const box = await this.colorSpectrum.boundingBox();
    if (box) {
      await this.colorSpectrum.click({ position: { x: box.width - 2, y: 2 } });
    }
  }

  async setColorToLightBlue() {
    await this.setColorViaHexInput(LIGHT_BLUE_HEX);
  }

  async setColorToLightGreen() {
    await this.setColorViaHexInput(LIGHT_GREEN_HEX);
  }

  async setColorToDarkOrange() {
    await this.setColorViaHexInput(DARK_ORANGE_HEX);
  }

  async setColorToDarkGrey() {
    await this.setColorViaHexInput(DARK_GREY_HEX);
  }

  async setColorToYellow() {
    await this.setColorViaHexInput(YELLOW_HEX);
  }

  async closeColorPicker() {
    // Click the editor header bar (top ~30px, always outside the tether popover and the canvas)
    // Avoids: canvas clicks (change panel to element props), Escape (closes the settings panel)
    await this.page.mouse.click(400, 25);
    await this.colorSpectrum.waitFor({ state: 'hidden' });
  }

  // --- Navigation tab: logo ---

  async openNavigationLogoMediaLibrary() {
    await this.navigationLogoThumbnail.waitFor({ state: 'visible' });
    await this.navigationLogoThumbnail.click();
    await this.page.getByRole('heading', { name: 'Media library', level: 3 }).waitFor({ state: 'visible' });
  }

  async selectFoleonLogoAndConfirm() {
    await this.page.getByLabel(/Monosnap logo/).getByRole('checkbox').check();
    await this.page.getByRole('button', { name: 'Choose' }).click();
    await this.page.getByRole('heading', { name: 'Media library', level: 3 }).waitFor({ state: 'hidden' });
  }

  async expectCanvasLogoIsVisible() {
    await expect(this.canvasLogoImage).toBeVisible();
  }

  // --- Content tab: typography H1 ---

  async openHeader1ForEditing() {
    await this.panelHeader1.click();
    await this.rteFontFamily.waitFor({ state: 'visible' });
  }

  async setFontToLucidaSansUnicode() {
    await this.rteFontFamily.click();
    await this.page.getByText('Lucida Sans Unicode').click();
  }

  async setHeader1FontColorToDarkOrange() {
    await this.fontColorPicker.click();
    await this.colorSpectrum.waitFor({ state: 'visible' });
    await this.setColorToDarkOrange();
  }

  async setHeader1FontColorToYellow() {
    await this.fontColorPicker.click();
    await this.colorSpectrum.waitFor({ state: 'visible' });
    await this.setColorToYellow();
  }

  // --- Assertions ---

  async expectSwatchIsRed() {
    // rgb(250-255, 0-9, 0-9) -- allows slight sub-pixel deviation from spectrum click
    await expect(this.firstSolidSwatch.getByTestId('theme-panel_swatch')).toHaveCSS(
      'background-color',
      /rgb\(25[0-5], [0-9]{1,2}, [0-9]{1,2}\)/,
    );
  }

  async expectPageBackgroundIsLightBlue() {
    // nth(0)=swatch__inner__wrapper, nth(1)=swatch__inner-background, nth(2)=colored div
    await expect(this.pageBackgroundSwatch.locator('div').nth(2)).toHaveCSS(
      'background-color',
      LIGHT_BLUE_RGB,
    );
  }

  async expectCanvasPageBackgroundIsLightBlue() {
    await expect(this.canvasPage).toHaveCSS('background-color', LIGHT_BLUE_RGB);
  }

  async expectPanelHeader1FontIsLucidaSansUnicode() {
    await expect(this.panelHeader1Heading).toHaveCSS('font-family', /Lucida Sans Unicode/);
  }

  async expectCanvasHeader1FontIsLucidaSansUnicode() {
    await expect(this.canvasHeader1).toHaveCSS('font-family', /Lucida Sans Unicode/);
  }

  async expectPanelHeader1ColorIsDarkOrange() {
    await expect(this.panelHeader1Heading).toHaveCSS('color', DARK_ORANGE_RGB);
  }

  async expectCanvasHeader1ColorIsDarkOrange() {
    await expect(this.canvasHeader1).toHaveCSS('color', DARK_ORANGE_RGB);
  }

  async expectPanelHeader1ColorIsYellow() {
    await expect(this.panelHeader1Heading).toHaveCSS('color', YELLOW_RGB);
  }

  async expectCanvasHeader1ColorIsYellow() {
    await expect(this.canvasHeader1).toHaveCSS('color', YELLOW_RGB);
  }

  // --- Project navigation & new-doc creation ---

  async clickProjectNav() {
    await this.projectNavItem.click();
  }

  async hoverAndOpenProject(projectName: string) {
    const row = this.page
      .locator('tr, [role="row"], [role="listitem"]')
      .filter({ hasText: projectName })
      .first();
    await row.hover();
    await row.getByRole('button', { name: /open/i }).click();
  }

  async clickStartNewFoleonDoc() {
    await this.startNewFoleonDocButton.click();
  }

  async fillFoleonDocName(name: string) {
    await this.foleonDocNameInput.fill(name);
  }

  async confirmStartFoleonDoc() {
    await this.confirmFoleonDocButton.click();
  }

  async fillPageName(name: string) {
    await this.pageNameInput.fill(name);
  }

  async clickCreatePage() {
    await this.createPageButton.click();
  }

  async flagPageThumbnail() {
    await this.startFromScratchTile.click();
  }

  async waitForDocEditorReady() {
    await this.canvasPage.waitFor({ state: 'visible' });
  }

  async clickElementsTab() {
    await this.elementsTabButton.click();
  }

  async dragTitleElementToCanvas() {
    await this.titleElementCard.dragTo(this.canvasPage);
  }

  async expectDocSectionIsLightGreen(targetPage?: Page) {
    const p = targetPage ?? this.page;
    await expect(p.getByTestId('@foleon/maggie-viewer_section-component')).toHaveCSS(
      'background-color',
      LIGHT_GREEN_RGB,
    );
  }

  async expectDocHeader1IsOrange(targetPage?: Page) {
    const p = targetPage ?? this.page;
    await expect(
      p.getByTestId('ripley-core__text-item__header-one__component').first(),
    ).toHaveCSS('color', DARK_ORANGE_RGB);
  }

  async expectDocHeader1IsLucidaSansUnicode(targetPage?: Page) {
    const p = targetPage ?? this.page;
    await expect(
      p.getByTestId('ripley-core__text-item__header-one__component').first(),
    ).toHaveCSS('font-family', /Lucida Sans Unicode/);
  }

  // sourcePage defaults to this.page; pass a different Page to fire Preview from a tab other than
  // the main page (e.g. a template editor tab that was returned by hoverAndEditTemplate).
  async clickPreview(sourcePage?: Page): Promise<Page> {
    const p = sourcePage ?? this.page;
    const [previewPage] = await Promise.all([
      p.context().waitForEvent('page'),
      p.getByTestId('button-preview').click(),
    ]);
    await previewPage.waitForLoadState('domcontentloaded');
    await previewPage.getByTestId('@foleon/maggie-viewer_section-component').waitFor({ state: 'visible' });
    return previewPage;
  }

  async navigateToTemplates() {
    await super.goto('/');
    await this.templatesNavItem.click();
  }

  async navigateToModules() {
    await super.goto('/');
    await this.modulesNavItem.click();
  }

  async hoverAndEditTemplate(templateName: string): Promise<Page> {
    const row = this.page.getByRole('row', { name: new RegExp(templateName) });
    await row.hover();
    const [editorPage] = await Promise.all([
      this.page.context().waitForEvent('page'),
      row.getByRole('button', { name: 'Edit' }).click(),
    ]);
    await editorPage.waitForLoadState('domcontentloaded');
    await editorPage.getByTestId('@foleon/maggie-viewer_section-component').waitFor({ state: 'visible' });
    return editorPage;
  }
  
  async openModuleByUrl(url: string): Promise<Page> {
    const editorPage = await this.page.context().newPage();
    await editorPage.goto(url);
    await editorPage.waitForLoadState('domcontentloaded');
    const viewer = editorPage.getByTestId('@foleon/maggie-viewer_section-component');
    try {
      await viewer.waitFor({ state: 'visible', timeout: 20_000 });
    } catch {
      await editorPage.reload();
      await editorPage.waitForLoadState('domcontentloaded');
      await viewer.waitFor({ state: 'visible' });
    }
    return editorPage;
  }

  // Module Edit is a link (not a button like Templates)
  async hoverAndEditModule(moduleName: string): Promise<Page> {
    const row = this.page.getByRole('row', { name: new RegExp(moduleName) });
    await row.hover();
    const [editorPage] = await Promise.all([
      this.page.context().waitForEvent('page'),
      row.getByRole('link', { name: 'Edit' }).click(),
    ]);
    await editorPage.waitForLoadState('domcontentloaded');
    await editorPage.getByTestId('@foleon/maggie-viewer_section-component').waitFor({ state: 'visible' });
    return editorPage;
  }

  async switchTab(tab: ThemeTab) {
    if (tab === 'navigation') await this.tabNavigation.click();
    else if (tab === 'charts') await this.tabCharts.click();
    else await this.tabContent.click();
  }

  async openTypographyStyle(style: TypographyStyle) {
    await this.typographyPanel.getByText(style).click();
  }

  async expectModalVisible() {
    await expect(this.modal).toBeVisible();
  }
}
