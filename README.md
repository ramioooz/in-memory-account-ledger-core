# In-Memory Account Ledger Core

A small TypeScript program that replays account events and produces daily ledger and available balances. It supports credits, debits, authorization holds, settlements, reversals, overdraft fees, installments and interest without using floating-point money.

## What the project demonstrates

| Area | Verified behaviour |
| --- | --- |
| Event processing | Events are processed in their supplied arrival order. They are never sorted by `valueDay`. |
| Value-dated balances | Financial entries affect the day given by `valueDay`, while processing decisions use the information known on `eventDay`. |
| Append-only ledger | Accepted financial effects create immutable signed entries. Reversals append opposite entries instead of editing history. |
| Authorization holds | Holds reduce the available balance without changing the ledger balance. A matching settlement posts the real debit and releases the hold. |
| Late entry and fees | E7 arrives on Day 5 with Day 2 value. Its restated negative closes produce one AED 25 fee on Days 2, 4 and 5. |
| Reversal | E9 reverses E7's AED 620 principal. Previously posted fee entries remain because no fee-reversal event was supplied. |
| Exact money | AED uses two decimal places and BHD uses three. All values are stored as `bigint` minor units. |
| Installments | BHD 10.000 is conserved as BHD 3.334, BHD 3.333 and BHD 3.333. |
| Interest | Each positive daily close earns 0.04%. Rounded daily accruals are summed and posted once on Day 6. |
| Invalid input | Invalid events are recorded without changing the ledger. For example, a settlement with a zero or negative amount is rejected with `INVALID_AMOUNT`. |

## How replay works

```text
Source events in supplied arrival order
                 │
                 ▼
        Validate each event
                 │
                 ▼
 Append ledger entries, update holds,
       or record a processing error
                 │
                 ▼
 Recalculate value-dated balances and
       append any required daily fees
                 │
                 ▼
 Finalize every account through Day 6
       and capitalize daily interest
                 │
                 ▼
       Build the Day 1–6 report
```

The ledger is the source of financial truth. A balance is derived by summing an account's entries through a requested value day. Authorization state is stored separately because a hold reserves funds but is not yet a financial posting.

```text
ledger balance    = value-dated ledger entries
available balance = ledger balance - active authorization holds
```

## Project architecture

| File | Responsibility |
| --- | --- |
| [`src/index.ts`](src/index.ts) | Runs the supplied scenario and prints the daily report. |
| [`src/scenario.ts`](src/scenario.ts) | Defines the two accounts and the E1–E10 source events. |
| [`src/replay.ts`](src/replay.ts) | Validates and replays events, manages authorization state, assesses fees and capitalizes interest. |
| [`src/ledger.ts`](src/ledger.ts) | Stores immutable ledger entries and derives balances by value day. |
| [`src/money.ts`](src/money.ts) | Handles exact parsing, formatting, rounding and installment splitting. |
| [`src/report.ts`](src/report.ts) | Builds and formats Day 1–6 account reports. |
| [`src/types.ts`](src/types.ts) | Defines account, event, ledger, authorization and error types. |
| [`tests/`](tests) | Verifies money, authorizations, replay, fees, interest, reports and rejected outcomes. |

The implementation is intentionally in memory. It has no HTTP server, database or UI because the runnable unit is the ledger replay itself.

## Run locally

Requires Node.js `^20.19.0`, `^22.12.0` or `>=24.0.0`.

```bash
npm install
npm run replay
```

Useful verification commands:

```bash
npm test
npm run test:watch
npm run typecheck
```

- `npm run replay` processes E1–E10 and prints every daily account result.
- `npm test` runs the complete suite once.
- `npm run test:watch` reruns tests while files change.
- `npm run typecheck` checks the strict TypeScript types without producing build files.

## Test coverage

| Test file | Behaviour covered |
| --- | --- |
| [`tests/money.test.ts`](tests/money.test.ts) | AED/BHD precision, formatting, deterministic rounding and conserving installment splits. |
| [`tests/authorization.test.ts`](tests/authorization.test.ts) | Holds, settlements, invalid amounts, reference errors, duplicate IDs and decision-time reporting. |
| [`tests/replay.test.ts`](tests/replay.test.ts) | Late value dates, fee cascading, reversal validation and immutable ledger exposure. |
| [`tests/interest.test.ts`](tests/interest.test.ts) | Rounded daily interest accruals and one Day 6 capitalization entry. |
| [`tests/scenario.test.ts`](tests/scenario.test.ts) | Complete E1–E10 results, daily balances, installments and formatted output. |
| [`tests/rejected-criterion.test.ts`](tests/rejected-criterion.test.ts) | The rejected expectation that E9 removes E7-related fees. |

The suite contains 19 normal passing cases and one annotated expected-failure case. The expected failure is deliberate: it keeps a rejected outcome executable while allowing the normal test command to pass.

## Full verified replay

The following is the complete report produced by `npm run replay`:

```text
ACC-001 Day 1 | ledger AED 250.00 | available AED 250.00 | fees AED 0.00 | authorizations none | errors none
ACC-001 Day 2 | ledger AED 225.00 | available AED 25.00 | fees AED -25.00 | authorizations Auth-A:ACTIVE hold AED 200.00 | errors none
ACC-001 Day 3 | ledger AED 625.00 | available AED 425.00 | fees AED 0.00 | authorizations Auth-A:ACTIVE hold AED 200.00 | errors none
ACC-001 Day 4 | ledger AED 415.00 | available AED 415.00 | fees AED -25.00 | authorizations Auth-A:SETTLED original hold AED 200.00 settled AED 185.00 unused hold released AED 15.00 | errors E6:AUTHORIZATION_NOT_FOUND authorizationId=Auth-Z
ACC-001 Day 5 | ledger AED 390.00 | available AED 390.00 | fees AED -25.00 | authorizations Auth-A:SETTLED original hold AED 200.00 settled AED 185.00 unused hold released AED 15.00,Auth-B:REJECTED attempted hold AED 90.00 available at decision AED -230.00 reason INSUFFICIENT_AVAILABLE_BALANCE | errors none
ACC-001 Day 6 | ledger AED 390.93 | available AED 390.93 | fees AED 0.00 | authorizations Auth-A:SETTLED original hold AED 200.00 settled AED 185.00 unused hold released AED 15.00,Auth-B:REJECTED attempted hold AED 90.00 available at decision AED -230.00 reason INSUFFICIENT_AVAILABLE_BALANCE | errors none
ACC-002 Day 1 | ledger BHD 0.000 | available BHD 0.000 | fees BHD 0.000 | authorizations none | errors none
ACC-002 Day 2 | ledger BHD 0.000 | available BHD 0.000 | fees BHD 0.000 | authorizations none | errors none
ACC-002 Day 3 | ledger BHD 0.000 | available BHD 0.000 | fees BHD 0.000 | authorizations none | errors none
ACC-002 Day 4 | ledger BHD 0.000 | available BHD 0.000 | fees BHD 0.000 | authorizations none | errors none
ACC-002 Day 5 | ledger BHD 10.000 | available BHD 10.000 | fees BHD 0.000 | authorizations none | errors none
ACC-002 Day 6 | ledger BHD 10.008 | available BHD 10.008 | fees BHD 0.000 | authorizations none | errors none
```

## Supporting documentation

- [`NUMBERS.md`](NUMBERS.md): verified balances, fee calculations, interest and BHD installment allocation.
- [`AMBIGUITIES.md`](AMBIGUITIES.md): unclear requirements and the interpretations used by the implementation.
- [`REJECTED.md`](REJECTED.md): rejected outcomes and implementation approaches.
- [`docs/DESIGN.md`](docs/DESIGN.md): detailed design and replay decisions.
- [`output/pdf/architecture-tradeoffs.pdf`](output/pdf/architecture-tradeoffs.pdf): architecture, trade-offs and production considerations.
- [`WORKLOG.md`](WORKLOG.md): chronological implementation record.
