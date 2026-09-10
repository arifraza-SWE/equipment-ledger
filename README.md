# The Equipment Ledger

A ledger for the tool store on a construction site. The keeper at the hatch issues equipment
to workers, takes it back, holds reservations, and can answer "who had the gas detector at
14:20 last Tuesday" from the book rather than from memory.

The interesting part is not the forms. It is that the book stays right when two keepers click
at the same moment, when a return is written down two hours after it happened, when a time has
to be corrected without pretending the mistake never happened, and when a request is sent twice
because somebody double-clicked.

Stack: Next.js 15 (App Router), NestJS 11, MongoDB 8 with Mongoose, TypeScript throughout, one
npm workspace.

## Running it

You need Node 22 (see `.nvmrc`) and Docker.

```bash
npm install
cp .env.example .env
docker compose up -d        # single-node Mongo replica set on localhost:27017
npm run seed                # deterministic store, safe to run again
npm run dev                 # API on http://localhost:4000, web on http://localhost:3000
```

The first `docker compose up` initiates the replica set through the container's healthcheck,
so give it a few seconds before seeding. `npm run seed` builds the shared package, wipes the
`equipment_ledger` database and writes the fixed dataset described under "Seed". `npm run dev`
starts both sides with hot reload.

Tests need the same Mongo container. They use a separate database (`equipment_ledger_test`),
so they never touch what you are looking at in the browser.

```bash
npm test                    # unit + supertest e2e + invariants, in that order
npm run test:unit           # pure domain logic, no database
npm run test:e2e            # the API over HTTP against a seeded test database
npm run test:invariants     # the properties the assignment says must never break
npm run test:web            # Playwright against a running, seeded API (see apps/web/tests/README.md)
npm run lint && npm run typecheck && npm run build
```

Two shell scripts reproduce the two demonstrations that are awkward to do by hand:

```bash
scripts/concurrent-issue.sh HARN-014 20    # 20 simultaneous issues, one wins
scripts/replay-request.sh DRL-003 WKR-001  # same request three times, lands once
```

### Environment variables

Everything lives in one `.env` at the repository root; `.env.example` documents each value.

| Variable | Used by | Meaning |
| --- | --- | --- |
| `MONGODB_URI` | API, seed | Connection string. Must point at a replica set: the API uses transactions. |
| `MONGODB_TEST_URI` | tests | Same, different database name. Wiped before every test file. |
| `SITE_TIMEZONE` | API | The clock the site keeps. Used for every date and time the API puts in a message. |
| `NEXT_PUBLIC_SITE_TIMEZONE` | web | The same zone for the screens. Keep the two identical. |
| `API_PORT` | API | Defaults to 4000. |
| `WEB_ORIGIN` | API | Origins allowed by CORS, comma separated. Normally `http://localhost:3000`. |
| `NEXT_PUBLIC_API_URL` | web | Where the browser and the Next.js server reach the API. |
| `SEED_ANCHOR_DATE` | seed | Optional `YYYY-MM-DD`. Pins the seed's "today". |

There are no secrets in this project. Nothing is committed that should not be.

## The model

Four things exist, as in the brief, plus the keeper who writes them down.

**Asset**: one physical item with a tag, `HARN-014`, not "a harness". It has a kind, a
description, an optional certificate requirement, and the date it was registered in the store.
It carries no status field. Whether it is out, overdue, reserved or out of service is derived
from the ledger every time anyone asks.

**Worker**: a person who can hold assets, with zero or more certificates, each with an issue
and an expiry instant.

**Reservation**: a claim on one asset for a window in the future, made for a worker. Windows are
half-open, `[startsAt, endsAt)`, which is what makes 09:00-10:00 and 10:00-11:00 adjacent rather
than overlapping.

**Movement**: the ledger. One document per fact, four kinds: `issue`, `return`,
`out_of_service`, `back_in_service`. Every movement has an `effectiveAt` (when it happened, typed
by the keeper, may be in the past) and a `recordedAt` (the server clock at the moment it was
written). They are two fields and they stay two fields.

**Correction**: a record that one movement was wrong. It points at the original, carries the
reason and the keeper, and either points at a replacement movement (`amend`) or at nothing
(`void`). The original stays in the collection with `supersededByCorrectionId` set.

The states in the brief's strip (in store, reserved, issued, overdue, returned, out of service)
are all computed. Replaying an asset's effective movements in order gives its holder and its
service status at any instant; the reservations standing at that instant give "reserved"; the
issue's `dueAt` gives "overdue". Nothing is stored that could disagree with the ledger, because
the thing that would disagree does not exist.

### Collections and indexes

| Collection | What is in it | Indexes beyond `_id` |
| --- | --- | --- |
| `assets` | one document per tag; `_id` is the tag. Holds `version`, a counter every ledger write increments | none needed at this size; `_id` covers lookups |
| `workers` | `_id` is the worker id; certificates embedded (they belong to the worker and are read with it) | none |
| `keepers` | the people who can be picked from the list | none |
| `movements` | the ledger | `{assetId, effectiveAt, sequence}` for an asset's timeline and history; `{supersededByCorrectionId, effectiveAt}` for the as-of scan over effective entries; `{workerId, effectiveAt}` for a worker's page; `{recordedAt, _id}` for the paged ledger listing |
| `corrections` | one per corrected movement | `{originalMovementId}` unique, which is a second, database-level guarantee that a movement is corrected at most once; `{assetId, recordedAt}` for history |
| `reservations` | claims with their outcome | `{assetId, status, startsAt}` for the overlap check; `{workerId, startsAt}`; `{endsAt, startsAt}` for "what stood at this instant" |
| `idempotency_records` | one per `Idempotency-Key` seen | TTL on `claimedAt`, 24 hours |

`sequence` on a movement is the asset's `version` at the moment the movement was written. It only
matters when two entries share an `effectiveAt`; then the lower sequence comes first. A
replacement written by a correction inherits the sequence of the movement it replaces, so it
keeps its place among neighbours at the same instant.

### Transactions

Every command that touches the ledger runs inside one MongoDB transaction with snapshot read
concern and majority write concern:

- **issue**: read asset, worker, keeper, the asset's effective timeline, any reservation covering
  the instant; validate; increment `assets.version`; insert the movement; mark the reservation
  fulfilled.
- **return**: as above, plus optionally a second movement (`out_of_service`) and the voiding of
  standing reservations when the asset came back damaged.
- **correction**: read the original and the timeline; validate the corrected timeline;
  increment version; insert the correction; insert the replacement; flip
  `supersededByCorrectionId` on the original (conditionally, from null).
- **service status change**: as for the withdrawal above.
- **reservation**: read the timeline (for service status) and the overlapping reservations;
  increment version; insert.

If any step fails the transaction aborts and nothing is written, so the API never leaves a
movement without its correction, or a reservation marked fulfilled without its issue.

## Concurrency: how two keepers cannot both issue HARN-014

The race is plain: two requests read "nobody holds HARN-014", both decide the issue is fine,
both insert. Checking availability first does not help, however fast the database is.

What stops it is that every transaction that writes to an asset's ledger also writes the asset
document itself, through `AssetsRepository.claimLedgerWrite` in
`apps/api/src/modules/assets/assets.repository.ts`:

```ts
findOneAndUpdate({ _id: assetId, version: expectedVersion }, { $inc: { version: 1 } }, { session });
```

`expectedVersion` is the version read inside the same snapshot in which the timeline was read and
validated. Two concurrent transactions for the same asset both read version 41 and both try to
move it to 42. MongoDB detects the write conflict on the document and aborts the second one
with a transient `WriteConflict`. `TransactionRunner` (`apps/api/src/database/transaction-runner.ts`)
catches that, waits a jittered few milliseconds, and runs the whole unit of work again. This time
the timeline read includes the winner's issue, `findTimelineViolation` sees an issue on top of an
open holding, and the loser gets:

```
409 asset_already_issued
HARN-014 is already issued to Priya Raman (WKR-003); it went out at 07:45 UTC on 2026-09-10 and had not been returned at 07:45 UTC on 2026-09-10.
```

The version filter in the update is belt and braces: under snapshot isolation it cannot fail on
its own, but it makes the intent visible and it protects the invariant if somebody later calls
the repository outside a transaction.

The same mechanism serialises returns, corrections, service changes and reservations per asset,
because they all go through `claimLedgerWrite`. Two overlapping reservation requests both find no
overlap in their snapshots; only one gets to bump the version and commit; the other re-runs, finds
the first one's reservation, and is refused with `reservation_overlap`.

What it costs: writes to one asset are serialised, so the store cannot record two movements of
the same drill at the same millisecond. Nobody needs that. Losers pay one or two extra round
trips. A replica set is mandatory, even locally; the compose file provides one.

`test/e2e/concurrency.e2e-spec.ts` fires 25 simultaneous issues at HARN-014 and asserts one 201,
24 refusals naming the winner, one issue document in Mongo and a valid timeline. The invariant
run does the same across six assets at once and then checks every asset's ledger still
alternates issue and return.

## Idempotency: nothing lands twice

Every request that changes the ledger (`POST /movements/issues`, `POST /movements/returns`,
`POST /movements/:id/corrections`, `POST /assets/:id/service-status`, `POST /reservations`,
`DELETE /reservations/:id`) must carry an `Idempotency-Key` header. The web app generates a UUID
when a form is opened, keeps it in `sessionStorage` under the form's name, sends it with every
attempt, and only generates a new one after the API has answered with a final status. A
double-click, a retry after a timeout and a refresh mid-submit therefore all carry the same key.

Server side (`apps/api/src/common/idempotency`):

1. The interceptor computes a fingerprint: SHA-256 of method, path and the body with its keys
   sorted.
2. It inserts `{ _id: key, requestFingerprint, status: 'in_progress' }`. The `_id` index makes
   this the atomic claim: only one request per key can succeed here.
3. If the insert hits a duplicate, the existing record decides:
   - different fingerprint: `422 idempotency_key_reused`
   - completed: the stored status code and body are returned, with `Idempotency-Replayed: true`
   - still in progress and younger than 30 seconds: `409 idempotency_in_progress`
   - in progress but older than 30 seconds: the claim is taken over, on the assumption the
     first process died. Re-running is safe because the use case's own guards refuse a second
     issue of the same asset.
4. The handler runs. Its response is stored as completed, whether it was a 201 or a domain
   refusal, so a retried bad request gets the same answer. A 5xx releases the key so the client
   can try again.

Replaying stored 4xx bodies is deliberate: the client that retries is asking "what happened to my
request", and the answer is the same.

## Historical reconstruction: "as of"

`GET /ledger/as-of?at=2026-09-08T14:20:00Z` returns every asset registered by that instant with
its holder, service status, overdue flag and the reservations that stood at that time.
`GET /assets/:id` is the same computation for one asset at "now"; the dashboard is the same
computation for all assets at "now". There is no cached holder anywhere to disagree with.

The algorithm, in `StoreSnapshotService.storeAt`:

1. Assets with `registeredAt <= at`.
2. One aggregation over `movements` matching `supersededByCorrectionId: null` and
   `effectiveAt <= at`, grouped by asset and track (holding track: issue/return; service track:
   out_of_service/back_in_service), taking the latest entry per group with `$top` sorted by
   `effectiveAt` then `sequence`. A latest holding entry of type `issue` means held; anything
   else means in store. A latest service entry of type `out_of_service` means withdrawn.
3. Reservations that stood at `at`: created by then, not closed by then, not yet ended.
4. Assemble the snapshot per asset (`assembleAssetSnapshot`, a pure function shared with the
   single-asset path).

Boundary semantics: a movement takes effect at its own instant, inclusive. At exactly the issue
time the asset is out; at exactly the return time it is back. An `at` before the earliest
`registeredAt` returns an empty store and `storeOpenedAt`, so the UI can say the store did not
exist yet.

`test/invariants/reconstruction.invariant-spec.ts` re-implements the replay naively over raw
documents and compares it with the API at 288 four-hourly ticks plus a sample of movement
boundaries (one millisecond before, at, one after).

## Corrections, not erasures

A movement is never edited or deleted. `POST /movements/:id/corrections` with `kind: 'amend'`
writes a correction document (reason, keeper, recorded time, the list of field changes from
and to), inserts a replacement movement carrying the corrected values and a
`createdByCorrectionId`, and sets `supersededByCorrectionId` on the original. `kind: 'void'`
does the same without a replacement.

Reads that answer "what happened" ignore superseded entries. Reads that answer "what was
written" (the history page, the raw collection) show everything: the original, struck through in
the UI, the correction with its reason, and the replacement. A movement can be corrected once;
the replacement can be corrected again, so the chain is auditable end to end. Two keepers
correcting the same movement at once: the conditional update from `null` on the original lets one
through; the unique index on `originalMovementId` backs it up.

A correction is validated like any other write: the asset's timeline with the replacement in the
original's place must still be possible. Moving a return before its issue, or an issue on top of
another holding, is refused with `correction_invalid` and the reason. Voiding an issue that
fulfilled a reservation reopens that reservation.

## Backdated entries

The keeper types `effectiveAt`; the server stamps `recordedAt`. An `effectiveAt` in the future
(beyond a two-minute tolerance) is refused; reservations are how you claim the future.

A new movement must come after the last effective entry on that asset's ledger. Backdating a
return to 09:00 at 11:40 is fine if nothing else happened to the asset in between. Slotting a
movement into the middle of recorded history is refused:

```
422 timeline_conflict
LAD-002 already has a later entry on its ledger (returned at 09:00 UTC on 2026-09-05). A new entry cannot be slotted in before it. If that later entry is wrong, correct it instead.
```

This rule falls out of the alternation: inserting a single entry into a valid issue/return/issue
sequence anywhere but the end always puts two of the same kind next to each other. Corrections,
which replace an entry in place, are the way to repair the interior. The trade-off is that a
forgotten whole loan (issue and return, both in the past, between two recorded loans) cannot be
backfilled with the current commands; see "What I would do with another day".

## One site, one clock

Instants are stored in UTC, as they should be. Showing them is a different question, and getting
it wrong bites twice.

Formatting in whatever timezone the code happens to be running in means the Next.js server and
the browser can produce different strings for the same instant, which is a hydration mismatch the
first time the server and the laptop are in different zones. It also lets the two halves of the
system disagree in public: a certificate that lapses at 23:59 UTC on the 9th reads as the 10th on
a screen an hour ahead, while the API's refusal still says the 9th.

So the site keeps one clock. `SITE_TIMEZONE` and `NEXT_PUBLIC_SITE_TIMEZONE` name the same IANA
zone, the shared package formats every instant on it, and a `datetime-local` input is read back
as a wall-clock time on that zone rather than the browser's. Both default to UTC, which is what
the seeded demo runs on, so a time on screen is the same string you will find in the document.
Set them to `Europe/London` (or anything else) and the screens, the seed's day boundaries and the
API's sentences all move together. The Playwright suite pins the browser to New York to make sure
nothing has quietly gone back to reading the browser's zone.

## Certificates

An asset may require one certificate type. At issue, and at reservation for the start of the
window, the worker must hold a certificate of that type with `issuedAt <= instant < expiresAt`,
where `instant` is the effective time, not the wall clock. A certificate that ran out at 23:59
yesterday still covers a return-dated issue from yesterday morning; it does not cover one today:

```
422 certification_expired
Liam Doherty (WKR-007) cannot receive GAS-004 because the required Gas Detection certification expired on 2026-09-09.
```

## Out of service

`POST /assets/:id/service-status` with `out_of_service` and a reason, or a return with
`takeOutOfService: true`, writes an `out_of_service` movement (so it is dated, recorded and
correctable like everything else). From that instant the asset cannot be issued or newly
reserved.

Policy for the two awkward cases, both of which the seed and the tests cover:

- **Withdrawn while issued.** The holding stays open. The worker still has the thing, and the
  ledger says so: the dashboard shows "issued" with an out-of-service flag, and the asset cannot
  be re-issued after it comes back until somebody brings it back into service.
- **Withdrawn while reserved.** Standing reservations are voided, with `closedReason: "Asset
taken out of service"` and the time. They are not deleted; they show in the reservations list
  and the response to the withdrawal lists them so the keeper can tell the workers. Nothing is
  restored automatically when the asset returns to service; the worker re-reserves. I chose
  voiding over leaving reservations active because a reservation is a promise the store can no
  longer keep, and a dashboard that shows an unissuable asset as "reserved" is lying.

## Reservations

A reservation must end after it starts, cover at least 15 minutes and at most 14 days, start no
earlier than now (two-minute tolerance) and no later than 90 days ahead. The asset must be in
service and the worker must hold the certificate the asset needs, judged at the window's start.
The window may not overlap any `active` or `fulfilled` reservation on the same asset; cancelled
and voided ones do not count. The overlap check and the insert share the transaction and the
asset-version bump described under Concurrency, so two overlapping requests cannot both succeed.

A reservation that was never collected stays `active` and is shown as `uncollected`; the asset
can be issued to anyone once the window has passed. Inside the window, the asset can only go to
the worker who reserved it (the issue links to the reservation automatically, or by
`reservationId`), and the due time defaults to the end of the window.

## Seed

`npm run seed` writes a fixed store and can be run as often as you like. Every document id is
derived from a label with SHA-1, so a second run produces the same `_id`s and the same
documents; the seed empties the collections first and re-checks every asset's timeline with the
same validator the API uses before writing anything. Dates are relative to an anchor: today at
00:00 UTC by default, or `SEED_ANCHOR_DATE=YYYY-MM-DD` to pin it, which the test suite does.

What is in it: 60 assets across nine kinds (14 harnesses, 6 gas detectors, 10 drills, 6
grinders, 8 ladders, 4 laser levels, 4 towers, 4 cut-off saws, 4 radios), four certificate
types, 12 workers, 3 keepers, thirty days of same-day loans, and these named situations:

| To demonstrate | Use |
| --- | --- |
| a normal issue | `DRL-003`, in store, needs no certificate |
| a refused issue / expired certificate | `GAS-004` to `WKR-007` (Liam Doherty), whose Gas Detection certificate expired yesterday; he held `GAS-004` ten days ago when it was valid |
| a concurrent issue | `HARN-014`, in store; `WKR-001/002/003/005/012` are all certified |
| a backdated return | `DRL-007`, out with `WKR-006` since yesterday 07:35 |
| a correction already in the book | `GRN-002`: return written as 17:00 nine days ago, corrected to 15:30 forty minutes later, reason recorded |
| a late-logged entry | `LAD-002`: returned 09:00 five days ago, written down at 11:40 |
| a reservation clash | `TWR-001`, reserved by `WKR-003` the day after tomorrow 08:00-12:00; `LVL-001` has two adjacent windows the same day |
| an uncollected reservation | `DRL-001`, reserved by `WKR-009` three days ago, never issued |
| out of service | `GAS-002` (failed bump test six days ago; its reservation was voided), `SAW-003` (returned damaged two days ago) |
| an overdue asset | `HARN-003`, out with `WKR-004` since four days ago, due back that evening |
| a certificate expiring inside the window | `WKR-004` (Callum Reid), Working at Height, expires in three days |
| a historical question | two days ago at 14:20, `GAS-001` was with `WKR-005` (Daniel Okafor); eight assets were out in total |

The seed refuses to run when `NODE_ENV=production`.

## API

Resource-oriented, JSON in and out, every error in one shape:

```json
{
  "statusCode": 409,
  "code": "asset_already_issued",
  "message": "…a sentence a keeper can act on…",
  "details": {}
}
```

400 is a malformed request, 404 an unknown id, 409 a conflict with the current state (already
issued, overlapping reservation, already corrected), 422 a rule refusal (certificate, out of
service, timeline). Stack traces never leave the process; 5xx bodies are generic and the detail
goes to the log.

| Method and path | Purpose |
| --- | --- |
| `GET /assets`, `GET /assets/:assetId` | current state, derived from the ledger |
| `GET /assets/:assetId/history` | every movement including superseded ones, corrections, reservations |
| `POST /assets/:assetId/service-status` | withdraw or restore |
| `GET /workers`, `GET /workers/:workerId`, `GET /keepers` | the lists the keeper picks from |
| `GET /reservations`, `POST /reservations`, `DELETE /reservations/:id` | claims |
| `POST /movements/issues`, `POST /movements/returns` | the two hatch actions |
| `POST /movements/:movementId/corrections` | amend or void |
| `GET /ledger/as-of?at=` | the store at an instant |
| `GET /ledger/movements?assetId&workerId&from&to&cursor&limit` | the paged ledger, newest first |
| `GET /health` | database connectivity |

## Testing

`apps/api/src/**/*.spec.ts` (56 tests) cover the pure domain: the timeline validator, the
certificate check, reservation window rules, snapshot assembly, request fingerprints, instant
parsing. `apps/api/test/e2e` (84 tests) drive the real HTTP app against a seeded test database
with a frozen clock and cover every refusal listed in the brief, including the concurrent and
replayed ones. `apps/api/test/invariants` (20 tests) state the properties directly and check
them by reading Mongo, not by asking the API: one holder per asset after storms of simultaneous
requests and across ten thousand sampled instants; no overlapping reservations after a storm;
no issue ever authorised by a lapsed certificate; no issue inside an out-of-service interval;
repeated requests land once; the as-of answer equals an independent replay; documents reference
each other consistently. `apps/web/tests` (Playwright) covers the screens the assessor will
click: the dashboard, a double-clicked issue, a refused issue, the as-of view, a reservation
clash.

## Trade-offs

- **Ledger plus a version counter, no projections.** The dashboard recomputes state from the
  movements collection on every request. At sixty assets and a few hundred movements this is
  milliseconds; at a million movements it would still be one indexed aggregation, and if that
  ever hurt I would add a projection fed from the same transaction rather than trust a cache.
- **Transactions instead of a unique index.** A partial unique index on "open issues" would
  guard issues alone. The version-bump-in-transaction guards every kind of write with one
  mechanism and keeps the movement, the correction and the reservation updates atomic together.
  The price is the replica set requirement.
- **Append-only after the last entry.** Simple to reason about and to explain at the hatch; the
  cost is that a wholly forgotten past loan needs a paired backfill command that does not exist.
- **Idempotency key in a header, required.** The client must send it. The upside is that a curl
  replay with the same header gets a replay, and a request without a key is refused rather than
  silently treated as new.
- **Voiding reservations on withdrawal.** Explained above; the other choice is defensible too.
- **A fake clock in tests, not in production.** `CLOCK` is an injectable so tests can freeze
  "now"; production uses the system clock. That is the only abstraction added purely for tests.
- **No client-side data cache.** The web app re-fetches from the server after every write rather
  than keeping a copy it has to invalidate. At this size the request costs nothing, and it means
  no screen can show a state the API has not confirmed.

## What I would do with another day

- A paired "backfill loan" command for a forgotten issue and return in the past.
- An audit view across the whole store of corrections, with filters.
- Rate limiting and request ids in the logs; a request id in the error body would make support
  conversations easier.
- Playwright coverage for the correction form and the out-of-service flow (the API paths are
  covered; the screens are exercised by hand).
- A worker-facing "my reservations" page.

## Knowingly left out

No authentication, roles or permissions (the keeper and the worker are picked from a list, as
the brief says). No email, no file uploads, no barcode scanning, no mobile app, no multi-site.
No soft-delete or archiving of assets and workers, no editing of the catalogue through the UI
(the seed is the catalogue).

## Layout

```
apps/api        NestJS API: modules/{assets,workers,keepers,ledger,movements,reservations}, seed, tests
apps/web        Next.js app: app/ routes, features/{ledger,movements,reservations,assets,workers}, components, lib
packages/shared the wire contract and rule constants both sides import
scripts         the two demo scripts
```

`ARCHITECTURE_GUIDE.md` walks through the request flow, the folders, the important files and
where to look when something goes wrong.
