# qa-toolbox-js

Small, reusable building blocks for test automation in JavaScript/TypeScript.
Every file is short, self-contained and commented only where the code has a trap.

## What's inside

### Utilities (`utils/`)

| File | What it solves |
| --- | --- |
| [`retry.ts`](utils/retry.ts) | Re-runs a flaky action with exponential backoff |
| [`waitUntil.ts`](utils/waitUntil.ts) | Polls a condition until it's true, with a hard timeout and a clear error |
| [`apiRequest.ts`](utils/apiRequest.ts) | Typed `fetch` wrapper that fails loudly on HTTP errors |

They compose well: `retry(() => apiRequest<User>("/api/users/1"))`.

### Cypress patterns (`cypress/`)

| File | Pattern |
| --- | --- |
| [`support/pages/LoginPage.ts`](cypress/support/pages/LoginPage.ts) | Page Object: tests say *what* to do, the page object knows *how* |
| [`support/commands.ts`](cypress/support/commands.ts) | Custom commands (`getByDataTest`, cached `login` via `cy.session`) |
| [`e2e/login.cy.ts`](cypress/e2e/login.cy.ts) | Example spec that reads like a plain-language scenario |

The example tests run against [saucedemo.com](https://www.saucedemo.com), a public practice shop.

### CI (`.github/workflows/`)

[`cypress.yml`](.github/workflows/cypress.yml) runs the tests on every push and pull request,
and keeps screenshots as evidence when a test fails.

## Design principles

- **Small and focused:** one file, one job.
- **Comments explain the *why*:** not what the line does, but why it's written this way.
- **Typed:** TypeScript catches typos before a test run does.

## Getting started

```bash
git clone https://github.com/Szymon-Wierzchowski/qa-toolbox-js.git
cd qa-toolbox-js
npm install
npx cypress open
```

## License

[MIT](LICENSE)
