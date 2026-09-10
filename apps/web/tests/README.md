# Web end-to-end tests

The tests drive the real API on port 4000 against the seeded store, so start Mongo, seed and run
the API first:

```bash
docker compose up -d
npm run seed
cd apps/api && npx nest build && node dist/main.js
```

Then, from `apps/web`:

```bash
npx playwright install chromium
npm run test:e2e
```

Playwright starts the Next.js dev server on port 3000 unless one is already listening there. If
3000 is taken, run on another port and tell the API to allow it:

```bash
WEB_ORIGIN=http://localhost:3000,http://localhost:3100   # in .env, before starting the API
WEB_PORT=3100 npm run test:e2e
```

`issue-idempotency.spec.ts` issues DRL-003, which changes the store. Run `npm run seed` at the
repository root before each run so the fixture is back where the tests expect it.

The browser runs in `America/New_York` on purpose. Everything on screen is shown on the site's
clock, so a test that starts passing only in one browser timezone means something has slipped
back to reading the browser's.
