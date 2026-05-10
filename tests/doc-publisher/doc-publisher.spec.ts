import { test, expect } from '../../fixtures';

const EDITOR_URL = 'https://editor.acceptance.foleon.cloud/doc/209452/pages/2101304';

test.describe('Doc Publisher', () => {
  test('can edit text in Doc Publisher and publish', async ({ docPublisherPage }) => {
    const randomText = `E2E edit ${Date.now()}`;

    await test.step('Open Doc Publisher editor', async () => {
      await docPublisherPage.gotoEditor(EDITOR_URL);
    });

    await test.step('Click text element on canvas and change text', async () => {
      await docPublisherPage.editFirstTextElement(randomText);
    });

    await test.step('Publish the document', async () => {
      await docPublisherPage.publish();
    });
  });
});
