# In-Memory Account Ledger Core

A small TypeScript ledger that replays a fixed stream of credits, debits, authorization holds, settlements and reversals. It keeps financial entries append-only, derives balances by value day and handles daily fees and interest with exact minor-unit arithmetic.

## Run

Requires Node.js 20 or newer.

```text
npm install
npm test
npm run typecheck
npm run replay
```

The replay prints ledger balance, available balance, fees, authorization state and processing errors for each account from Day 1 through Day 6.

## Approach

- Process source events in their supplied arrival order; never sort the stream.
- Append accepted financial effects as immutable, signed ledger entries.
- Use `valueDay` to derive daily balances and `eventDay` for processing decisions.
- Keep authorization holds outside the ledger because they reduce available balance only.
- Append one AED 25 fee for every negative daily close caused by information known during replay.
- Finalize all accounts through Day 6, calculate rounded daily interest and append one capitalization credit.
- Store AED and BHD values as `bigint` minor units.

## Verified result

```text
ACC-001 Day 6 | ledger AED 390.93 | available AED 390.93
ACC-002 Day 6 | ledger BHD 10.008 | available BHD 10.008
```

Numerical details are in [NUMBERS.md](NUMBERS.md). Requirement interpretations and rejected outcomes are recorded in [AMBIGUITIES.md](AMBIGUITIES.md) and [REJECTED.md](REJECTED.md).
