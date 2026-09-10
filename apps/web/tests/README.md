# Web end-to-end tests

The tests drive the real API on port 4000 against the seeded store, so start Mongo, seed and run the API first:

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

The Playwright config starts the Next.js dev server on port 3100 if nothing is listening there.

`issue-idempotency.spec.ts` issues DRL-003, which changes the store. Re-run `npm run seed` at the repository root before every run so the fixture is back where the tests expect it.
