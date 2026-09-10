# Architecture guide

A working tour of the code. Read it once and you should be able to find anything, change
anything, and know where to look when something misbehaves. The README covers the domain
decisions and why they were made; this covers where they live.

## 1. The big picture

Two applications and one shared package, in one npm workspace. The browser never talks to
MongoDB, and the Next.js server has no business logic in it.

```
Browser
  │  form submit, with an Idempotency-Key it generated once
  ▼
Next.js  ── server components render, client components submit
  │        apps/web/src/app/**
  ▼
API client  ── one typed fetch wrapper, turns error bodies into thrown errors
  │           apps/web/src/lib/api-client.ts
  ▼
NestJS controller  ── validates the shape, nothing else
  │                  apps/api/src/modules/**/*.controller.ts
  ▼
Idempotency interceptor  ── claims the key, replays a stored answer if it has seen it
  │                        apps/api/src/common/idempotency/idempotency.interceptor.ts
  ▼
Use case  ── opens one transaction, reads, decides, writes
  │         apps/api/src/modules/movements/*.use-case.ts
  ▼
Domain functions  ── pure, no database, no framework
  │                 apps/api/src/modules/ledger/domain/*.ts
  ▼
Repositories  ── the only code that knows about Mongoose
  │             apps/api/src/modules/**/*.repository.ts
  ▼
MongoDB
```

Reads take a shorter path: a server component calls the API client, a controller calls a query
service, the query service calls repositories and pure assembly functions. No interceptor, no
transaction.

## 2. Folder map

```
packages/shared/src        The wire contract. Types for every request and response, the domain
                           vocabulary (asset kinds, certification types, movement types), rule
                           constants both sides need, and the site-clock formatting functions.
                           Compiled to dist/ before either app builds. If a field changes shape,
                           it changes here first and both sides stop compiling until they agree.

apps/api/src
  main.ts                  Boots Nest, reads the environment, turns on CORS.
  app.module.ts            Wires the modules, registers the global validation pipe and the
                           exception filter. Takes the Mongo URI as an argument so tests can
                           point it at their own database.
  config/                  environment.ts reads and checks the env; site-time.ts binds the
                           configured timezone to the shared formatting functions.
  common/errors/           DomainError and its subclasses (the only errors a use case throws),
                           the mapper that turns anything into an ApiError body, and the filter
                           that writes it to the response.
  common/idempotency/      The interceptor, the service that claims and completes keys, the
                           record schema, and the request fingerprint.
  common/time/             Instant parsing and arithmetic. Clock is an injectable so tests can
                           freeze "now".
  common/validation/       The IsInstant and IsIdentifier decorators and the ObjectId pipe.
  database/                The Mongoose connection module and TransactionRunner.
  modules/assets/          The asset document, its repository, and claimLedgerWrite.
  modules/workers/         The worker document, its repository, the certificate check and the
                           sentences it produces when a certificate does not cover an issue.
  modules/keepers/         The list of people who can be picked at the hatch.
  modules/ledger/          Everything that reads the ledger. domain/ holds the pure timeline and
                           snapshot functions; persistence/ holds the movement, correction and
                           reservation schemas and repositories; the services and controllers on
                           top answer the store, asset-history, worker and as-of questions.
  modules/movements/       Everything that writes to the ledger: the four use cases, the shared
                           timeline guards, and the two controllers.
  modules/reservations/    Creating and cancelling claims, and the pure window rules.
  seed/                    The fixed store: the catalogue, the named scenarios, the routine
                           thirty days, and the writer that puts them in the database.
  test/                    support/ (test harness), e2e/ (the API over HTTP),
                           invariants/ (properties checked against raw documents).

apps/web/src
  app/                     Routes. Each page is a server component that loads data and hands it
                           to feature components. Thin by design.
  components/              Pieces with no domain knowledge: Button, Field, DataTable, Notice,
                           StatusBadge, TimestampPair, Instant, KeeperSelect, EmptyState.
  features/<area>/         Domain UI grouped by what it is for: api/ (typed calls),
                           components/, hooks/. Areas: ledger, movements, reservations, assets,
                           workers.
  hooks/                   use-idempotency-key and use-ledger-submission, shared by every form.
  lib/                     api-client, site-time, idempotency-key, keeper-storage, class-names.

scripts/                   Two shell scripts that reproduce the concurrency and replay demos.
```

## 3. The files that matter most

Read these seven and you have the system.

| File | What it does |
| --- | --- |
| `apps/api/src/modules/ledger/domain/asset-timeline.ts` | The heart. Pure functions over a list of movements: sort them, replay them into a state, find the state at an instant, and decide whether a proposed sequence is possible. No database, no Nest. Every write validates through `findTimelineViolation`; every read derives through `replayTimeline` or `stateAt`. |
| `apps/api/src/modules/movements/issue-asset.use-case.ts` | The clearest example of a command: one transaction, read the parties and the timeline, resolve a reservation, build the candidate entry, check the whole timeline with it, check the certificate at the effective instant, claim the write, insert. |
| `apps/api/src/modules/assets/assets.repository.ts` | `claimLedgerWrite` is the line that makes two simultaneous issues impossible. It bumps `assets.version` inside the caller's transaction; MongoDB refuses to let two transactions do that to the same document. |
| `apps/api/src/database/transaction-runner.ts` | Runs a unit of work in a snapshot transaction and re-runs it, with jittered backoff, when MongoDB reports a write conflict. The loser of a race re-reads and gets the proper refusal instead of an internal error. |
| `apps/api/src/modules/ledger/store-snapshot.service.ts` | Answers "what did the store look like at this instant" from the movements collection. The dashboard is this with instant = now. Nothing else knows how state is derived. |
| `apps/api/src/common/idempotency/idempotency.interceptor.ts` | Claims the key before the handler runs, stores the answer after, replays it next time. |
| `apps/web/src/hooks/use-ledger-submission.ts` | The other half of idempotency. Owns the key, sends it, decides what the screen is allowed to claim, and refreshes the server data on success. |

## 4. What happens when an asset is issued

1. `IssueAssetForm` collects asset, worker, time, optional due time, note, and reads the keeper
   from the header. `useLedgerSubmission` refuses to fire twice at once and attaches the key.
2. `POST /movements/issues` with `Idempotency-Key`.
3. `IdempotencyInterceptor` fingerprints the request and inserts the claim. A duplicate key with
   the same body returns the stored answer and stops here.
4. `ValidationPipe` checks the DTO: identifiers look like identifiers, `effectiveAt` is a real
   ISO instant with a zone, no unknown fields.
5. `IssueAssetUseCase.execute` parses the instants, then opens a transaction and inside it:
   - loads the asset, worker and keeper, 404 if any is missing;
   - loads the asset's effective timeline;
   - `assertEntryCanBeAppended` refuses a future time, a time before the asset was registered,
     and a time before the last entry already on the ledger;
   - resolves a reservation, either the one named or one covering the instant, and refuses if
     the covering one belongs to somebody else;
   - builds the candidate entry and runs `findTimelineViolation` over the whole sorted timeline,
     which is what catches "already issued";
   - checks the certificate at `effectiveAt`, not at now;
   - `claimLedgerWrite` bumps the asset version, which both serialises the write and provides
     the movement's `sequence`;
   - inserts the movement and marks the reservation fulfilled.
6. If MongoDB reports a write conflict, `TransactionRunner` runs all of step 5 again against the
   committed state. The second run sees the other keeper's issue and throws
   `asset_already_issued`.
7. The interceptor stores the response, success or refusal, against the key.
8. `MovementResultSummary` shows the effective and recorded times and the asset's new status;
   `router.refresh()` re-renders the server data behind the form.

## 5. What happens when an asset is returned

Same shape, in `ReturnAssetUseCase`. The differences worth knowing:

- The holder comes from replaying the timeline, not from the request. The request only says who
  handed it back, and if that is not the holder the API refuses unless
  `acknowledgeDifferentReturner` is set. The stored movement keeps both: `workerId` is who had
  it, `returnedByWorkerId` is who brought it in.
- A return at or before the instant of the issue it closes is refused.
- `takeOutOfService` writes a second movement in the same transaction through
  `ServiceWithdrawalRecorder`, which also voids the reservations still standing on that asset and
  returns them so the screen can list them.

## 6. What happens when a reservation is made

`CreateReservationUseCase`:

1. `findReservationWindowProblem` (pure, in `modules/reservations/domain/reservation-window.ts`)
   checks ordering, minimum and maximum length, and how far ahead the window starts.
2. Inside the transaction: the asset must be in service, judged by replaying the timeline; the
   worker must hold the certificate the asset needs at the window's start.
3. `findOverlapping` looks for an `active` or `fulfilled` reservation on the same asset with
   `startsAt < endsAt AND endsAt > startsAt`. Half-open comparison is why adjacent windows are
   allowed and overlapping ones are not.
4. `claimLedgerWrite` bumps the asset version, then the reservation is inserted.

Two requests for overlapping windows both find nothing in their own snapshot; only one can bump
the version, so the other re-runs and finds the first one. Overlap prevention is the same
mechanism as one-holder, not a separate one.

## 7. Concurrency: where to look

- `apps/api/src/modules/assets/assets.repository.ts` — `claimLedgerWrite`, the conditional
  `$inc` on the asset document.
- `apps/api/src/database/transaction-runner.ts` — snapshot transactions, conflict detection,
  retry with backoff.
- Every use case calls `claimLedgerWrite` before it inserts. If you add a command that writes to
  a ledger, it must too, or it opts out of the guarantee.
- `apps/api/test/e2e/concurrency.e2e-spec.ts` — 25 simultaneous issues, one succeeds.
- `apps/api/test/invariants/one-holder.invariant-spec.ts` — the same across six assets, then a
  check that every ledger still alternates.
- `scripts/concurrent-issue.sh` — the same thing by hand against a running API.

## 8. Idempotency: where to look

- Server: `apps/api/src/common/idempotency/` — the interceptor claims, the service owns the
  record, `request-fingerprint.ts` decides what "the same request" means.
- Client: `apps/web/src/lib/idempotency-key.ts` stores one key per form in `sessionStorage`;
  `use-idempotency-key.ts` reads it; `use-ledger-submission.ts` sends it and rotates it only
  after a final answer. A refresh mid-submit reloads the same key from storage.
- The interceptor is applied per controller with `@UseInterceptors(IdempotencyInterceptor)`. A
  new command endpoint must be on a controller that has it.
- `apps/api/test/e2e/idempotency.e2e-spec.ts` and
  `apps/api/test/invariants/idempotency.invariant-spec.ts`.

## 9. Historical reconstruction: where to look

- `apps/api/src/modules/ledger/store-snapshot.service.ts` — `storeAt(instant)`.
- `apps/api/src/modules/ledger/persistence/movements.repository.ts` —
  `findLatestEffectivePerAsset`, the aggregation that takes the latest effective entry per asset
  per track.
- `apps/api/src/modules/ledger/domain/asset-snapshot.ts` — turns a holding, a service status and
  the standing reservations into a snapshot. Shared by the whole-store and single-asset paths, so
  they cannot drift.
- `apps/api/src/modules/ledger/domain/asset-timeline.ts` — `stateAt`, the single-asset replay.
- `apps/api/test/invariants/reconstruction.invariant-spec.ts` — a second, naive implementation
  over raw documents, compared with the API at hundreds of instants.

Boundaries: a movement takes effect at its own instant, inclusive. Everything uses `<=`.

## 10. Corrections: the model

A correction is a document, not an edit.

```
movements:   [issue 07:35] [return 11:00  superseded → C1] [return 09:00  createdBy → C1]
corrections: C1 { originalMovementId: <the 11:00 one>, replacementMovementId: <the 09:00 one>,
                  kind: 'amend', reason, keeperId, recordedAt, changes: [effectiveAt 11:00→09:00] }
```

- Reads that answer "what happened" filter `supersededByCorrectionId: null`.
- Reads that answer "what was written" (`GET /assets/:id/history`, the collection itself) return
  everything.
- `CorrectMovementUseCase` validates the corrected timeline before writing, using
  `withEntryReplaced` plus `findTimelineViolation`, so a correction cannot create an impossible
  history.
- A movement can be corrected once. `markSuperseded` updates conditionally from `null`, and
  `corrections.originalMovementId` is a unique index. Correct the replacement to go further.
- `kind: 'void'` writes no replacement. Voiding an issue that fulfilled a reservation reopens it.

## 11. Database

| Collection | Key fields |
| --- | --- |
| `assets` | `_id` is the tag. `version` counts ledger writes and is the concurrency guard and the sequence source. `registeredAt` bounds how far back movements may be dated. |
| `workers` | `_id` is the worker id. `certifications[]` embedded, each with `type`, `issuedAt`, `expiresAt`. |
| `keepers` | `_id`, `fullName`. |
| `movements` | `assetId`, `type`, `workerId`, `returnedByWorkerId`, `keeperId`, `effectiveAt`, `recordedAt`, `dueAt`, `reservationId`, `note`, `sequence`, `supersededByCorrectionId`, `createdByCorrectionId`. |
| `corrections` | `originalMovementId` (unique), `replacementMovementId`, `kind`, `reason`, `keeperId`, `recordedAt`, `changes[]`. |
| `reservations` | `assetId`, `workerId`, `startsAt`, `endsAt`, `status`, `fulfilledByMovementId`, `closedAt`, `closedReason`. |
| `idempotency_records` | `_id` is the key. `requestFingerprint`, `status`, `response`, `claimedAt` (TTL 24h). |

Relationships are by id, resolved in the service layer. There are no Mongoose `populate` calls:
the name lookups are explicit batch reads (`findByIds`), which is why no list endpoint does one
query per row.

Indexes and the reason each exists are listed in the README under "Collections and indexes".
`syncIndexes()` runs during seeding; `autoIndex` is on for the app.

Transactions: `TransactionRunner.run` is used by all four movement use cases and by creating and
cancelling a reservation. Reads use no transaction.

## 12. Frontend

- **Pages** are server components. They call the API through `attemptRequest`/`attemptAll`, which
  turn a failure into a value rather than an exception, so a page renders `LoadFailure` instead
  of blowing up. Nothing is cached (`cache: 'no-store'`).
- **Feature modules** own their own API functions and components. `features/ledger` renders the
  asset table and the as-of view; `features/movements` owns the three forms and the correction
  UI; `features/reservations`, `features/assets` and `features/workers` follow the same shape.
- **State** is deliberately boring: server components hold the data, `useState` holds form
  values, `router.refresh()` re-fetches after a write. There is no client cache and no store
  library, so nothing on screen can disagree with the API.
- **Forms** all go through `useLedgerSubmission`, which returns a state machine:
  `idle → submitting → succeeded | refused | unconfirmed`. `refused` shows the API's own
  sentence. `unconfirmed` (a network failure or a 5xx) says the store did not confirm and keeps
  the key so a retry is safe. Only `succeeded` renders a result, and only from a 2xx body.
- **Times** are formatted by `lib/site-time.ts`, always on the site's clock, so a server render
  and a browser render produce the same string. `datetime-local` values are read back as site
  wall-clock times, not browser-local ones.
- **The keeper** is chosen in the header, kept in `localStorage` by `KeeperProvider`, and every
  form refuses to submit without one.

## 13. Tests: what each suite proves

| Suite | Command | What it proves |
| --- | --- | --- |
| `apps/api/src/**/*.spec.ts` | `npm run test:unit` | The pure rules in isolation: timeline validity and replay, `stateAt` boundaries, certificates judged at an instant, reservation windows, snapshot assembly, request fingerprints, instant parsing, the site clock. |
| `apps/api/test/e2e` | `npm run test:e2e` | The API over HTTP against a seeded database with a frozen clock: every success and every refusal named in the brief, with the exact messages. |
| `apps/api/test/invariants` | `npm run test:invariants` | The properties, checked against raw documents rather than the API: one holder, no overlap, no lapsed certificate, no issue while out of service, no duplicate on repeat, as-of equals an independent replay, documents reference each other consistently. |
| `apps/web/tests` | `npm run test:web` | The screens: the dashboard, a double-clicked issue landing once, a refused issue showing the API's sentence, the as-of view, a reservation clash. The browser runs in a different timezone from the site on purpose. |

The e2e and invariant suites boot the real Nest application on an ephemeral port and re-seed
before each file, so they are order-independent.

## 14. How to make common changes

**Add an asset kind.** `packages/shared/src/assets.ts`: add to `ASSET_KINDS` and
`ASSET_KIND_LABELS`. TypeScript then points at anything that needs updating. Add a range to
`ASSET_RANGES` in `apps/api/src/seed/catalogue.ts` if the seed should stock it.

**Add a certification type.** Same file: `CERTIFICATION_TYPES` and `CERTIFICATION_LABELS`. Give
some workers the certificate in `apps/api/src/seed/catalogue.ts`.

**Add a movement type.** `packages/shared/src/movements.ts` (`MOVEMENT_TYPES` and its labels),
then teach `asset-timeline.ts` what it does in `replayTimeline` and `findTimelineViolation`, and
decide which track it belongs to (`HOLDING_MOVEMENT_TYPES` or `SERVICE_MOVEMENT_TYPES`, which the
as-of aggregation uses). Then write the use case.

**Change a reservation rule.** `packages/shared/src/reservations.ts` for the numbers,
`apps/api/src/modules/reservations/domain/reservation-window.ts` for the logic and the sentence.
Both have unit tests next to them.

**Add an API endpoint.** Put the DTO in the module's `dto/`, the logic in a use case or query
service, and a thin method on the controller. If it writes to the ledger, the controller needs
`@UseInterceptors(IdempotencyInterceptor)` and the use case needs `TransactionRunner` and
`claimLedgerWrite`. Add the request and response types to `packages/shared` so the web app can
call it typed.

**Add a page.** A folder under `apps/web/src/app`, a server component that calls
`features/<area>/api`, and components in `features/<area>/components`. Add the link to
`AppNav.tsx`.

**Change the seed.** Named situations live in `apps/api/src/seed/scenarios.ts`; the filler thirty
days in `routine-loans.ts`; the catalogue and people in `catalogue.ts`. Any asset you write a
scenario for must be listed in `SCENARIO_ASSETS` so the routine generator leaves it alone. The
seed re-validates every timeline before it writes, so a mistake fails loudly rather than
producing an impossible store.

## 15. Where to start when something is wrong

**An issue is refused and you disagree.** The error `code` names the check. `asset_already_issued`
or `asset_not_issued` came from `findTimelineViolation`; `timeline_conflict` from
`assertEntryCanBeAppended` (future, before registration, or before the last entry);
`certification_*` from `checkCertification`; `asset_out_of_service` from the replayed service
status. Fetch `GET /assets/:id/history` and read the effective entries in order.

**A return is refused.** Usually the holder is not who you think, or the effective time is at or
before the issue. The history page shows both. Remember the API refuses a return from a
non-holder unless the request acknowledges it.

**A reservation is refused.** `reservation_window_invalid` is the pure window check and the
message names the rule. `reservation_overlap` names the conflicting reservation and its window;
`GET /reservations?assetId=…` lists them. Cancelled and voided ones do not block.

**The as-of answer looks wrong.** Compare the two implementations. `GET /assets/:id/history`
shows every entry with its superseded flag; anything with `supersededByCorrectionId` set is
ignored by the as-of query. Then check the boundary: at exactly a movement's instant, the
movement has taken effect. If the whole-store answer and the single-asset answer disagree, the
bug is in `findLatestEffectivePerAsset`, because everything else is shared.

**A concurrency test fails.** First check Mongo is a replica set (`docker compose ps`, and
`rs.status()` inside the container); transactions fail outright without one. If exactly one
request no longer wins, look for a write path that inserts a movement without calling
`claimLedgerWrite`. If several requests fail with `concurrent_modification` instead of a domain
refusal, the retry budget in `TransactionRunner` ran out under the load.

**The seed fails.** It validates before it writes. "would give X an impossible history" means the
scenarios and the routine loans collided on an asset: add the asset to `SCENARIO_ASSETS`. "seed
movement references unknown asset" means a scenario names an asset the catalogue does not stock.

**The web app and the API disagree.** Check the footer, which shows the API address the browser
is using, and the health banner. If times differ, `SITE_TIMEZONE` and `NEXT_PUBLIC_SITE_TIMEZONE`
have drifted apart; they are meant to be the same zone.

**A form says nothing happened but the movement exists.** That is the `unconfirmed` state: the
request went out and the answer did not come back. The key is kept, so submitting again replays
rather than duplicates. The history page is the truth.
