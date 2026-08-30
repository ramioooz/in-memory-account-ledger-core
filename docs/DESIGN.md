# In-Memory Account Ledger Core Design

## Scope

Build a small TypeScript program that replays the supplied E1–E10 event stream and prints Day 1–6 account results. The result includes closing ledger balances, overdraft fees, authorization states and processing errors.

The solution is intentionally in memory. It has no API, database, UI, framework, generic event-sourcing layer or full accounting system.

## Approach

Process source events once in their supplied order. Accepted financial operations append immutable ledger entries. Authorization holds are maintained separately because they affect available balance, not ledger balance. Daily reports are calculated from ledger entry value dates.

This preserves both timelines:

- `eventDay`: when an event is received and processed.
- `valueDay`: when its financial effect belongs.

Earlier authorization decisions are not rerun when a late event restates a historical balance.

## Components

The implementation is divided into focused modules:

- `types.ts`: source events, ledger entries and report shapes.
- `money.ts`: minor-unit arithmetic, rounding, splitting and formatting.
- `ledger.ts`: append-only entries and balance queries.
- `replay.ts`: event processing, holds, fee assessment and interest.
- `scenario.ts`: the supplied E1–E10 stream and account configuration.
- `report.ts`: Day 1–6 output formatting.
- `index.ts`: runnable entry point.

## Money

All amounts use `bigint` minor units:

- AED has two decimal places; AED 25.00 is stored as `2500` fils.
- BHD has three decimal places; BHD 10.000 is stored as `10000` fils.

Floating-point numbers are not used for financial calculations.

Rounding is deterministic: round to the nearest minor unit, with an exact half rounded away from zero. The daily interest rate is represented as the exact fraction `4 / 10000`, equal to 0.04%.

Installment splitting conserves the original amount. BHD 10.000 split three ways produces `3.334`, `3.333`, `3.333`; the first installment receives the single remaining minor unit.

## Ledger entries and balances

Each accepted financial effect appends a signed entry containing:

- entry ID
- source event ID
- account ID and currency
- signed minor-unit amount
- value day
- entry type

Entries are never edited or deleted. A reversal appends the opposite amount with its stated value day.

For account `A` on day `D`:

```text
ledgerBalance(A, D) = sum(entries for A where valueDay <= D)
```

Authorization requests and holds are not ledger entries.

## Authorization holds and available balance

Replay maintains a small in-memory lookup keyed by authorization ID. Each record contains the account, requested hold, current status, relevant event days and any rejection reason.

An authorization is approved only when:

```text
ledger balance - existing active holds - requested hold >= 0
```

Approval creates an active hold. Rejection creates no hold and no ledger entry.

For Auth-A:

- E3 approves an AED 200 hold when the known ledger balance is AED 250, leaving AED 50 available.
- E5 appends the AED 185 settlement debit, releases the complete AED 200 hold and marks Auth-A settled.

E6 is rejected because Auth-Z does not exist. E8 rejects Auth-B because the known Day 5 available balance is insufficient after E7 and its fees.

For any day:

```text
available balance = ledger balance - active approved holds
```

## Replay flow

For each event in supplied order:

1. Validate its account, currency, amount and references.
2. Apply its event-type rule.
3. Append accepted financial entries.
4. Update authorization holds when applicable.
5. Record a rejection or processing error without a financial effect.
6. Reconcile overdraft fees through the event day when a financial entry changes a closing balance.

Replay continues after a rejected operation or invalid source event. An internal invariant failure stops execution so the program cannot present a result it cannot trust.

## Late value-dated entries and fees

E7 is received on Day 5 and appends an AED 620 debit with value date Day 2. Closing balances are recalculated chronologically from Day 2 through Day 5 using the entries known at that point.

An AED 25 fee is appended once for each negative daily close that has not already been assessed. An appended fee affects subsequent days. This produces fees for Day 2, Day 4 and Day 5; Day 3 closes positive after the Day 3 credit.

E9 appends an AED 620 reversal with value date Day 2. It reverses E7's principal effect but does not delete or implicitly reverse the previously appended fees.

After E9, ACC-001's pre-interest closing balances are:

```text
Day 1  AED 250.00
Day 2  AED 225.00
Day 3  AED 625.00
Day 4  AED 415.00
Day 5  AED 390.00
Day 6  AED 390.00
```

## Interest

Interest is calculated after all supplied events have been replayed, using the final restated positive closing balances before capitalization. Each daily accrual is rounded to the account currency's precision. The stored daily accruals are summed and appended as one credit at the end of Day 6.

ACC-001 daily accruals are:

```text
AED 0.10 + 0.09 + 0.25 + 0.17 + 0.16 + 0.16 = AED 0.93
```

ACC-002 has BHD 10.000 on Days 5 and 6:

```text
BHD 0.004 + 0.004 = BHD 0.008
```

No interest entry is posted on Days 1–5. Day 6 closing balances include the single capitalization credit.

## Reporting

After replay, the program prints Day 1–6 results for each account:

- closing ledger balance
- fees assessed for that day
- authorization status and active hold
- available balance
- processing errors

Financial balances come from value-dated ledger entries. Authorization status comes from the replayed authorization lookup and its event days. Errors are plain event-level records containing the event ID, event day, short code and message.

## Testing

Five focused tests cover:

1. money precision and BHD installment allocation
2. authorization holds and settlement behavior
3. E7 late posting, daily fees, E9 reversal and retained fees
4. daily interest rounding and Day 6 capitalization
5. the complete E1–E10 replay and Day 1–6 report

One additional annotated expected-failure test preserves the rejected expectation that E9 removes all effects of E7. The expectation fails because appended fees remain. Marking it as an expected failure keeps the normal test command useful while making the disagreement executable and visible.

Assertions use explicit amounts rather than broad snapshots.

## Required documentation

- `README.md`: setup, commands, approach and example output.
- `NUMBERS.md`: constants, currency precision and rounding decisions.
- `AMBIGUITIES.md`: genuine ambiguities and selected interpretations.
- `REJECTED.md`: rejected criteria and deliberately avoided approaches.
- `WORKLOG.md`: timestamped entries recorded as work occurs.

The architecture and trade-offs PDF is a separate later deliverable.
