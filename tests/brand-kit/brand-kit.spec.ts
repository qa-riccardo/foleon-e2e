import { test, expect } from '../../fixtures';

test.describe('Brand Kits', () => {
  test('Brand Kit creation, customization, saving and application to Doc Editor, Template Editor, Module Editor', async ({ brandKitPage }) => {
    test.setTimeout(90_000);

    await test.step('Navigate to Brand Kits and open the editor', async () => {
      await brandKitPage.navigateToBrandKits();
      await brandKitPage.createButton.click();
    });

    await test.step('Basics: set first solid swatch to red', async () => {
      await brandKitPage.openFirstSolidSwatchColorPicker();
      await brandKitPage.setColorToRedViaSpectrum();
      await brandKitPage.closeColorPicker();
      await expect(brandKitPage.colorSpectrum).not.toBeVisible();
      await brandKitPage.expectSwatchIsRed();
    });

    await test.step('Basics: set page background to light blue and verify on canvas', async () => {
      await brandKitPage.openPageBackgroundColorPicker();
      await brandKitPage.setColorToLightBlue();
      await brandKitPage.closeColorPicker();
      await expect(brandKitPage.colorSpectrum).not.toBeVisible();
      await brandKitPage.expectPageBackgroundIsLightBlue();
      await brandKitPage.expectCanvasPageBackgroundIsLightBlue();
    });

    await test.step('Navigation: assign foleon_logo.jpeg and verify logo appears in canvas', async () => {
      await brandKitPage.switchTab('navigation');
      await brandKitPage.openNavigationLogoMediaLibrary();
      await brandKitPage.selectFoleonLogoAndConfirm();
      await brandKitPage.expectCanvasLogoIsVisible();
    });

    await test.step('Content: set background color to light green', async () => {
      await brandKitPage.switchTab('content');
      await brandKitPage.openContentBackgroundColorPicker();
      await expect(brandKitPage.colorSpectrum).toBeVisible();
      await brandKitPage.setColorToLightGreen();
      await brandKitPage.closeColorPicker();
      await expect(brandKitPage.colorSpectrum).not.toBeVisible();
    });

    await test.step('Content: set Header 1 font to Lucida Sans Unicode and verify in panel and canvas', async () => {
      await brandKitPage.openHeader1ForEditing();
      await brandKitPage.setFontToLucidaSansUnicode();
      await brandKitPage.expectPanelHeader1FontIsLucidaSansUnicode();
      await brandKitPage.expectCanvasHeader1FontIsLucidaSansUnicode();
    });

    await test.step('Content: set Header 1 font color to dark orange and verify in panel and canvas', async () => {
      await brandKitPage.setHeader1FontColorToDarkOrange();
      await brandKitPage.closeColorPicker();
      await expect(brandKitPage.colorSpectrum).not.toBeVisible();
      await brandKitPage.expectPanelHeader1ColorIsDarkOrange();
      await brandKitPage.expectCanvasHeader1ColorIsDarkOrange();
    });

    await test.step('Content: add Mode 2 and set background to dark grey', async () => {
      await brandKitPage.dismissRTE();
      await brandKitPage.addNewMode();
      await brandKitPage.openContentBackgroundColorPicker();
      await brandKitPage.setColorToDarkGrey();
      await brandKitPage.closeColorPicker();
      await expect(brandKitPage.colorSpectrum).not.toBeVisible();
    });

    await test.step('Content: Mode 2 — set Header 1 color to yellow and verify in panel and canvas', async () => {
      await brandKitPage.openHeader1ForEditing();
      await brandKitPage.setHeader1FontColorToYellow();
      await brandKitPage.closeColorPicker();
      await expect(brandKitPage.colorSpectrum).not.toBeVisible();
      await brandKitPage.expectPanelHeader1ColorIsYellow();
      await brandKitPage.expectCanvasHeader1ColorIsYellow();
    });

    await test.step('Charts: set chart background to dark color', async () => {
      await brandKitPage.dismissRTE();
      await brandKitPage.switchTab('charts');
      await brandKitPage.openChartBackgroundColorPicker();
      await brandKitPage.setColorToDarkGrey();
      await brandKitPage.closeColorPicker();
      await expect(brandKitPage.colorSpectrum).not.toBeVisible();
    });

    await test.step('Save brand kit with a unique name', async () => {
      await brandKitPage.dismissRTE();
      await brandKitPage.saveButton.click();
      await brandKitPage.expectModalVisible();
      const name = `E2E Smoke — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
      await brandKitPage.modalNameInput.fill(name);
      await brandKitPage.modalSaveButton.click();
      await expect(brandKitPage.modal).not.toBeVisible();
    });

    await test.step('Create a new Foleon Doc in the Brand Kit Application project', async () => {
      await brandKitPage.clickProjectNav();
      await brandKitPage.hoverAndOpenProject('Brand Kit Application');
      await brandKitPage.clickStartNewFoleonDoc();
      const docName = `E2E Smoke — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
      await brandKitPage.fillFoleonDocName(docName);
      await brandKitPage.confirmStartFoleonDoc();
      await brandKitPage.fillPageName('Cover');
      await brandKitPage.clickCreatePage();
      await brandKitPage.flagPageThumbnail();
      await brandKitPage.clickCreatePage();
    });

    await test.step('Doc Editor: verify Brand Kit page background, then drag Title element to canvas', async () => {
      await brandKitPage.waitForDocEditorReady();
      await brandKitPage.expectCanvasPageBackgroundIsLightBlue();
      await brandKitPage.clickElementsTab();
      await brandKitPage.dragTitleElementToCanvas();
      await brandKitPage.expectDocSectionIsLightGreen();
      await brandKitPage.expectDocHeader1IsOrange();
      await brandKitPage.expectDocHeader1IsLucidaSansUnicode();
    });

    await test.step('Preview: verify Brand Kit section background, text color and font', async () => {
      const previewPage = await brandKitPage.clickPreview();
      await brandKitPage.expectDocSectionIsLightGreen(previewPage);
      await brandKitPage.expectDocHeader1IsOrange(previewPage);
      await brandKitPage.expectDocHeader1IsLucidaSansUnicode(previewPage);
      await previewPage.close();
    });

    await test.step('Template Editor: open Block Brand Kit and verify Brand Kit colors and font', async () => {
      await brandKitPage.navigateToTemplates();
      const templateEditorPage = await brandKitPage.hoverAndEditTemplate('Block Brand Kit');
      await brandKitPage.expectDocSectionIsLightGreen(templateEditorPage);
      await brandKitPage.expectDocHeader1IsOrange(templateEditorPage);
      await brandKitPage.expectDocHeader1IsLucidaSansUnicode(templateEditorPage);
      const templatePreviewPage = await brandKitPage.clickPreview(templateEditorPage);
      await brandKitPage.expectDocSectionIsLightGreen(templatePreviewPage);
      await brandKitPage.expectDocHeader1IsOrange(templatePreviewPage);
      await brandKitPage.expectDocHeader1IsLucidaSansUnicode(templatePreviewPage);
      await templatePreviewPage.close();
      await templateEditorPage.close();
    });

    await test.step('Module Editor: open Module Brand Kit and verify Brand Kit colors and font', async () => {
      const moduleEditorPage = await brandKitPage.openModuleByUrl('https://editor.acceptance.foleon.cloud/module/86');
      await brandKitPage.expectDocSectionIsLightGreen(moduleEditorPage);
      await brandKitPage.expectDocHeader1IsOrange(moduleEditorPage);
      await brandKitPage.expectDocHeader1IsLucidaSansUnicode(moduleEditorPage);
      await moduleEditorPage.close();
    });
  });
});
