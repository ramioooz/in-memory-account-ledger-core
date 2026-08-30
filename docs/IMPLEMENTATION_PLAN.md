# In-Memory Account Ledger Core Implementation Plan

**Goal:** Build the approved TypeScript replay program, focused tests and required documentation.

**Architecture:** Replay the supplied events in order, append immutable value-dated ledger entries and track authorization holds separately. Derive daily ledger and available balances from the resulting entries and holds, while preserving posted fees when a later reversal restates history.

**Tech stack:** Node.js, TypeScript, `bigint`, Vitest and tsx.

**Spec:** `docs/DESIGN.md`

## Global constraints

- Keep the implementation in memory with no API, database or UI.
- Store every financial amount as `bigint` minor units.
- Use AED precision 2 and BHD precision 3.
- Process E1–E10 in the supplied order while applying financial effects by value day.
- Never mutate or delete a ledger entry.
- Keep authorization holds outside the ledger balance.
- Keep code and documentation concise and free of duplicated explanations.
- Preserve the branch and unsquashed commit history.
- Capture each `WORKLOG.md` timestamp from `date -Iseconds` when the work occurs; do not reconstruct entries later.

## File map

- `.gitignore`: ignore installed dependencies, build output and local tooling files.
- `package.json`: replay, test and type-check commands.
- `package-lock.json`: pinned development dependencies.
- `tsconfig.json`: strict TypeScript configuration.
- `src/types.ts`: accounts, events, entries, authorizations, errors and reports.
- `src/money.ts`: exact parsing, formatting, ratio rounding and installment splitting.
- `src/ledger.ts`: append-only entry storage and value-day balance queries.
- `src/replay.ts`: event processing, authorization holds, fee reconciliation and interest.
- `src/scenario.ts`: ACC-001, ACC-002 and E1–E10.
- `src/report.ts`: Day 1–6 report construction and formatting.
- `src/index.ts`: executable replay entry point.
- `tests/money.test.ts`: exact money and installment behavior.
- `tests/authorization.test.ts`: approval, holds, settlement and rejection behavior.
- `tests/replay.test.ts`: late posting, fees and reversal behavior.
- `tests/interest.test.ts`: daily accrual and capitalization behavior.
- `tests/scenario.test.ts`: complete stream and daily result assertions.
- `tests/rejected-criterion.test.ts`: annotated expected failure.
- `README.md`: setup, commands, approach and output.
- `NUMBERS.md`: constants and numerical decisions.
- `AMBIGUITIES.md`: ambiguous requirements and chosen interpretations.
- `REJECTED.md`: rejected criteria and abandoned approaches.
- `WORKLOG.md`: timestamped implementation record.

---

### Task 1: Project foundation and exact money

**Files:**

- Create: `.gitignore`
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `src/types.ts`
- Create: `src/money.ts`
- Create: `tests/money.test.ts`
- Create: `WORKLOG.md`

**Interfaces:**

```ts
export type Currency = "AED" | "BHD";
export type Day = 1 | 2 | 3 | 4 | 5 | 6;

export function parseMoney(value: string, currency: Currency): bigint;
export function formatMoney(value: bigint, currency: Currency): string;
export function roundRatio(
  value: bigint,
  numerator: bigint,
  denominator: bigint,
): bigint;
export function splitEvenly(total: bigint, parts: number): readonly bigint[];
```

- [ ] **Step 1: Create the TypeScript test harness**

Create scripts with these responsibilities:

```json
{
  "replay": "tsx src/index.ts",
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc --noEmit"
}
```

Install `typescript`, `tsx`, `vitest` and `@types/node` as development dependencies. Configure strict TypeScript with an ES2022 target and no emitted files.

- [ ] **Step 2: Write the failing money test**

Assert all of the following in `tests/money.test.ts`:

```ts
expect(parseMoney("25.00", "AED")).toBe(2500n);
expect(parseMoney("10.000", "BHD")).toBe(10000n);
expect(() => parseMoney("1.001", "AED")).toThrow();
expect(formatMoney(2500n, "AED")).toBe("25.00");
expect(splitEvenly(10000n, 3)).toEqual([3334n, 3333n, 3333n]);
expect(roundRatio(41500n, 4n, 10000n)).toBe(17n);
```

- [ ] **Step 3: Run the money test and confirm failure**

Run `npm test -- tests/money.test.ts`. Expected result: failure because `src/money.ts` does not exist.

- [ ] **Step 4: Implement exact money operations**

Use the currency scale to parse and format strings without converting through `number`. Implement ratio rounding to the nearest minor unit with exact halves away from zero. Implement `splitEvenly` using quotient and remainder so the first installments receive any remaining minor units.

- [ ] **Step 5: Verify and commit**

Run:

```text
npm test -- tests/money.test.ts
npm run typecheck
```

Expected result: both commands pass.

Commit as `feat: add exact money primitives`.

---

### Task 2: Append-only ledger and authorization holds

**Files:**

- Create: `src/ledger.ts`
- Create: `src/scenario.ts`
- Create: `src/replay.ts`
- Create: `tests/authorization.test.ts`
- Modify: `src/types.ts`
- Modify: `WORKLOG.md`

**Interfaces:**

```ts
export interface AccountConfig {
  readonly id: string;
  readonly currency: Currency;
}

interface BaseEvent {
  readonly id: string;
  readonly eventDay: Day;
  readonly valueDay: Day;
  readonly accountId: string;
  readonly currency: Currency;
}

export interface CreditEvent extends BaseEvent {
  readonly type: "CREDIT";
  readonly amount: bigint;
  readonly installments?: number;
}

export interface DebitEvent extends BaseEvent {
  readonly type: "DEBIT";
  readonly amount: bigint;
}

export interface AuthorizationEvent extends BaseEvent {
  readonly type: "AUTHORIZATION";
  readonly authorizationId: string;
  readonly holdAmount: bigint;
}

export interface SettlementEvent extends BaseEvent {
  readonly type: "SETTLEMENT";
  readonly authorizationId: string;
  readonly amount: bigint;
}

export interface ReversalEvent extends BaseEvent {
  readonly type: "REVERSAL";
  readonly reversesEventId: string;
}

export type SourceEvent =
  | CreditEvent
  | DebitEvent
  | AuthorizationEvent
  | SettlementEvent
  | ReversalEvent;

export type EntryType =
  | "CREDIT"
  | "DEBIT"
  | "SETTLEMENT"
  | "REVERSAL"
  | "OVERDRAFT_FEE"
  | "INTEREST";

export interface LedgerEntry {
  readonly id: string;
  readonly sourceEventId: string;
  readonly accountId: string;
  readonly currency: Currency;
  readonly amount: bigint;
  readonly valueDay: Day;
  readonly type: EntryType;
}

export class Ledger {
  append(entry: Omit<LedgerEntry, "id">): LedgerEntry;
  balance(accountId: string, throughDay: Day): bigint;
  allEntries(): readonly LedgerEntry[];
}

export interface ReplayOptions {
  readonly endDay: Day;
  readonly capitalizeInterest: boolean;
}

export interface ReplayError {
  readonly eventId: string;
  readonly eventDay: Day;
  readonly code: string;
  readonly message: string;
}

export interface InterestAccrual {
  readonly accountId: string;
  readonly currency: Currency;
  readonly day: Day;
  readonly amount: bigint;
}

export interface ReplayResult {
  readonly ledger: Ledger;
  readonly authorizations: ReadonlyMap<string, AuthorizationRecord>;
  readonly errors: readonly ReplayError[];
  readonly interestAccruals: readonly InterestAccrual[];
}

export function replay(
  accounts: readonly AccountConfig[],
  events: readonly SourceEvent[],
  options: ReplayOptions,
): ReplayResult;
```

- [ ] **Step 1: Define source event and authorization types**

Put the `AccountConfig`, source event, entry, authorization, error and accrual shapes above in `src/types.ts`; keep `ReplayResult` with `replay` in `src/replay.ts` to avoid a circular dependency on `Ledger`.

Define authorization records with:

```ts
export interface AuthorizationRecord {
  readonly authorizationId: string;
  readonly accountId: string;
  readonly currency: Currency;
  readonly holdAmount: bigint;
  status: "ACTIVE" | "SETTLED" | "REJECTED";
  decisionDay: Day;
  settledDay?: Day;
  rejectionReason?: "INSUFFICIENT_AVAILABLE_BALANCE";
}
```

- [ ] **Step 2: Write the failing authorization test**

Replay E1–E6 without interest and assert:

```ts
expect(authA.status).toBe("SETTLED");
expect(authA.holdAmount).toBe(20000n);
expect(authA.settledDay).toBe(4);
expect(settlementEntry.amount).toBe(-18500n);
expect(result.errors).toEqual([
  expect.objectContaining({ eventId: "E6", code: "AUTHORIZATION_NOT_FOUND" }),
]);
```

Also assert Auth-A leaves AED 50 available immediately after approval and that E6 appends no financial entry.

- [ ] **Step 3: Run the authorization test and confirm failure**

Run `npm test -- tests/authorization.test.ts`. Expected result: failure because ledger replay is not implemented.

- [ ] **Step 4: Implement ledger and authorization processing**

Append deterministic ledger entry IDs in insertion order. Calculate authorization approval from the ledger balance known at the event day minus active holds. On a matching settlement, append the settlement debit and release the complete hold. Record unknown authorization settlement as an event error and continue.

- [ ] **Step 5: Verify and commit**

Run:

```text
npm test -- tests/authorization.test.ts tests/money.test.ts
npm run typecheck
```

Expected result: both commands pass.

Commit as `feat: add ledger and authorization replay`.

---

### Task 3: Late posting, daily fees and reversal

**Files:**

- Modify: `src/replay.ts`
- Modify: `src/types.ts`
- Modify: `tests/authorization.test.ts`
- Create: `tests/replay.test.ts`
- Modify: `WORKLOG.md`

**Interfaces:**

```ts
export const OVERDRAFT_FEE_AED = 2500n;

export function activeHoldAtDay(
  authorization: AuthorizationRecord,
  day: Day,
): bigint;

export function availableBalanceAt(
  result: ReplayResult,
  accountId: string,
  day: Day,
): bigint;
```

- [ ] **Step 1: Write the failing late-posting test**

Replay E1–E9 without interest. Assert that E7 creates an AED 620 debit with Day 2 value date and that fees exist exactly once for Days 2, 4 and 5:

```ts
expect(feeEntries.map((entry) => [entry.valueDay, entry.amount])).toEqual([
  [2, -2500n],
  [4, -2500n],
  [5, -2500n],
]);
```

After E9, assert the pre-interest balances:

```ts
expect(days.map((day) => ledger.balance("ACC-001", day))).toEqual([
  25000n,
  22500n,
  62500n,
  41500n,
  39000n,
  39000n,
]);
```

Assert that E7 and E9 remain as two separate entries and that the three fee entries remain.

- [ ] **Step 2: Extend the authorization test for Auth-B**

Replay E1–E9 and assert:

```ts
expect(authB.status).toBe("REJECTED");
expect(authB.rejectionReason).toBe("INSUFFICIENT_AVAILABLE_BALANCE");
expect(activeHoldAtDay(authB, 5)).toBe(0n);
```

- [ ] **Step 3: Run the focused tests and confirm failure**

Run `npm test -- tests/replay.test.ts tests/authorization.test.ts`. Expected result: failure because fee reconciliation and reversal handling are missing.

- [ ] **Step 4: Implement daily closure and retrospective fee reconciliation**

Track which account/day fee assessments have already been appended. Close forward days only when an event day exceeds the highest event day seen so far. After any financial entry whose value day is already closed, recalculate chronologically from its value day through the latest closed day. Append missing AED 25 fees only when the day closes negative; let each appended fee affect following days. This also handles E10 appearing after E9 without moving the replay clock backwards.

Implement E9 by locating E7 and appending its opposite amount with Day 2 value date. Do not mutate E7 or remove fee entries. Do not rerun earlier authorization decisions.

- [ ] **Step 5: Verify and commit**

Run:

```text
npm test -- tests/money.test.ts tests/authorization.test.ts tests/replay.test.ts
npm run typecheck
```

Expected result: both commands pass.

Commit as `feat: support value-dated fees and reversals`.

---

### Task 4: Interest, installments and complete scenario

**Files:**

- Modify: `src/replay.ts`
- Complete: `src/scenario.ts`
- Create: `tests/interest.test.ts`
- Create: `tests/scenario.test.ts`
- Modify: `WORKLOG.md`

**Interfaces:**

```ts
export const DAILY_INTEREST_NUMERATOR = 4n;
export const DAILY_INTEREST_DENOMINATOR = 10000n;
```

- [ ] **Step 1: Write the failing interest test**

Replay all events with Day 6 capitalization. Assert ACC-001 accruals and capitalization:

```ts
expect(accrualsForAcc001.map((item) => item.amount)).toEqual([
  10n,
  9n,
  25n,
  17n,
  16n,
  16n,
]);
expect(interestEntryForAcc001.amount).toBe(93n);
```

Assert ACC-002 has Day 5 and Day 6 accruals of `4n` and one BHD `8n` capitalization entry.

- [ ] **Step 2: Write the failing full-scenario test**

Assert E10 appends three credits of `3334n`, `3333n`, `3333n` and their sum is `10000n`. Assert Day 6 ledger balances after interest are AED `39093n` and BHD `10008n`.

- [ ] **Step 3: Run both tests and confirm failure**

Run `npm test -- tests/interest.test.ts tests/scenario.test.ts`. Expected result: failure because installments and interest capitalization are missing.

- [ ] **Step 4: Implement installments and interest**

For installment credits, append one ledger entry per amount returned by `splitEvenly`, retaining E10 as the source event ID. After every source event and fee assessment is complete, calculate each positive pre-capitalization daily close, round it with `roundRatio`, retain the daily accrual and append their exact sum as one Day 6 interest credit.

- [ ] **Step 5: Verify and commit**

Run:

```text
npm test -- tests/money.test.ts tests/authorization.test.ts tests/replay.test.ts tests/interest.test.ts tests/scenario.test.ts
npm run typecheck
```

Expected result: both commands pass.

Commit as `feat: add installments and interest capitalization`.

---

### Task 5: Daily report, required documents and expected failure

**Files:**

- Create: `src/report.ts`
- Create: `src/index.ts`
- Create: `tests/rejected-criterion.test.ts`
- Modify: `tests/scenario.test.ts`
- Create: `README.md`
- Create: `NUMBERS.md`
- Create: `AMBIGUITIES.md`
- Create: `REJECTED.md`
- Modify: `WORKLOG.md`
- Modify: `package.json`

**Interfaces:**

```ts
export interface AuthorizationSummary {
  readonly authorizationId: string;
  readonly status: "ACTIVE" | "SETTLED" | "REJECTED";
  readonly activeHold: bigint;
  readonly rejectionReason?: "INSUFFICIENT_AVAILABLE_BALANCE";
}

export interface DailyAccountReport {
  readonly day: Day;
  readonly accountId: string;
  readonly currency: Currency;
  readonly ledgerBalance: bigint;
  readonly availableBalance: bigint;
  readonly fees: bigint;
  readonly authorizations: readonly AuthorizationSummary[];
  readonly errors: readonly ReplayError[];
}

export function buildDailyReports(
  result: ReplayResult,
  accounts: readonly AccountConfig[],
): readonly DailyAccountReport[];

export function formatReports(
  reports: readonly DailyAccountReport[],
): string;
```

- [ ] **Step 1: Extend the scenario test with daily reports**

Assert explicit Day 1–6 ledger and available balances, daily fees, Auth-A state changes, Auth-B rejection and the Day 4 E6 error. Assert output formatting preserves two AED decimals and three BHD decimals.

- [ ] **Step 2: Implement and run the report**

Build reports from ledger value dates, authorization decision/settlement days and event error days. Make `src/index.ts` replay the supplied scenario and print the formatted result.

Run `npm run replay`. Expected result: a readable Day 1–6 report for both accounts.

- [ ] **Step 3: Add the annotated expected-failure test**

Use Vitest's `test.fails` to assert the rejected expectation that E9 removes all E7-related fees. Add an inline comment explaining that E9 reverses the principal entry but the append-only rule retains previously posted fees, with the detailed rationale in `REJECTED.md`.

- [ ] **Step 4: Write the required documents**

Keep each document focused:

- `README.md`: prerequisites, install/test/replay commands, design summary and sample output.
- `NUMBERS.md`: AED/BHD precision, AED 25 fee, 0.04% interest, Day 6 capitalization and BHD installment allocation.
- `AMBIGUITIES.md`: late fee reconciliation, fee retention after reversal, daily interest rounding and out-of-order E10 handling.
- `REJECTED.md`: the four rejected criteria and the mutable-balance, aggregate-rounding and equal-installment approaches not used.
- `WORKLOG.md`: retain only genuine timestamps and work performed.

- [ ] **Step 5: Verify and commit**

Run:

```text
npm test
npm run typecheck
npm run replay
```

Expected result: tests and type checking pass; replay prints all six days. The annotated expected-failure executes as an expected failure without making the suite fail.

Commit as `docs: complete replay reporting and rationale`.

---

### Task 6: Final local verification and pull request

**Files:**

- Modify only files that fail the checks below.

- [ ] **Step 1: Run clean verification**

Run from a clean dependency install:

```text
npm install
npm test
npm run typecheck
npm run replay
```

Expected result: every command exits successfully and the replay contains Day 1–6 results for ACC-001 and ACC-002.

- [ ] **Step 2: Inspect scope and repository language**

Confirm there are no generated build artifacts, unrelated abstractions, duplicated explanations or prohibited attribution. Confirm `git diff --check` passes and the worktree is clean after the final commit.

- [ ] **Step 3: Push and open the implementation PR**

Push `feature/ledger-core` without deleting or rewriting earlier branches. Open a PR into `main` summarizing the replay rules, test evidence and documented decisions. Leave merging to the repository owner.

- [ ] **Step 4: Visibility reminder**

After the project is built and verified locally, remind the repository owner to make it public. Do not change repository visibility without explicit approval.
