# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install
npx playwright install

# Run all tests (requires .env with credentials)
npm test

# Run a single test file
npx playwright test tests/editor/canvas.spec.ts

# Run a single test by name
npx playwright test -g "can add a text element"

# Run with headed browser (useful for debugging)
npm run test:headed

# Open interactive UI mode
npm run test:ui

# Debug a specific test
npm run test:debug -- tests/editor/canvas.spec.ts

# Record a new test via codegen
npm run codegen

# View HTML report after a run
npm run report
```

## Architecture

### Pattern: Page Object Model (POM)

All selectors and page interactions live in `pages/`. Tests in `tests/` import fixtures from `fixtures/index.ts` — never import page objects directly in tests.

```
pages/
  base.page.ts          # Abstract base with shared helpers
  login.page.ts
  dashboard.page.ts
  editor/
    editor.page.ts      # Canvas, page list, properties panel
    toolbar.page.ts     # Element palette and action buttons

fixtures/
  index.ts              # Extends Playwright's test with typed page object fixtures

tests/
  auth/
    auth.setup.ts       # Runs once: logs in and saves .auth/user.json
    login.spec.ts       # Auth flow tests (runs without stored auth state)
  editor/
    create-publication.spec.ts
    canvas.spec.ts
```

### Authentication Flow

Playwright's "setup project" (`auth.setup.ts`) runs before all tests and writes a browser storage state to `.auth/user.json`. All non-auth tests then reuse this state via `storageState` in `playwright.config.ts`, so they start already logged in.

Login tests override this with `test.use({ storageState: { cookies: [], origins: [] } })` to start unauthenticated.

### Environment Variables

Copy `.env.example` to `.env` and fill in:
- `BASE_URL` — default `https://app.foleon.com`
- `USER_EMAIL` / `USER_PASSWORD` — credentials for a dedicated test account

`.auth/` and `.env` are gitignored.

## Key Conventions

- **Selectors**: prefer `getByRole`, `getByLabel`, `getByTestId` in that order. Avoid CSS selectors tied to class names that may change.
- **Assertions**: use `expect` from `fixtures/index.ts`, not directly from `@playwright/test`.
- **Test isolation**: each spec cleans up its own data in `afterEach`/`afterAll`. Use a unique name (e.g. append `Date.now()`) to avoid collisions between parallel runs.
- **Timeouts**: `actionTimeout` (15 s) and `navigationTimeout` (30 s) are set globally in `playwright.config.ts`. Override per-assertion only when a specific operation is known to be slow.
- **New feature area**: add a `pages/<feature>.page.ts`, register it in `fixtures/index.ts`, and create `tests/<feature>/` with specs.
