import { describe, expect, test } from "vitest";

import { replay } from "../src/replay.js";
import { accounts, events } from "../src/scenario.js";
import type { LedgerEntry } from "../src/types.js";
import {
  credit,
  debit,
  reversal,
  validationAccounts,
} from "./fixtures.js";

describe("late value-dated replay", () => {
  test("appends each required daily fee once and retains it after reversal", () => {
    const result = replay(accounts, events.slice(0, 9), {
      endDay: 6,
      capitalizeInterest: false,
    });
    const feeEntries = result.ledger
      .allEntries()
      .filter((entry) => entry.type === "OVERDRAFT_FEE");

    expect(feeEntries.map((entry) => [entry.valueDay, entry.amount])).toEqual([
      [2, -2500n],
      [4, -2500n],
      [5, -2500n],
    ]);
    expect(
      ([1, 2, 3, 4, 5, 6] as const).map((day) =>
        result.ledger.balance("ACC-001", day),
      ),
    ).toEqual([25000n, 22500n, 62500n, 41500n, 39000n, 39000n]);
    expect(
      result.ledger
        .allEntries()
        .filter((entry) => ["E7", "E9"].includes(entry.sourceEventId))
        .map((entry) => [entry.sourceEventId, entry.amount]),
    ).toEqual([
      ["E7", -62000n],
      ["E9", 62000n],
    ]);
  });

  test("rejects invalid amounts and mismatched or repeated reversals", () => {
    const result = replay(
      validationAccounts,
      [
        debit("D1", -1000n),
        credit("C1", "A", 10000n),
        reversal("R1", "C1", "B", 2),
        reversal("R2", "C1", "A", 2),
        reversal("R3", "C1", "A", 3),
      ],
      { endDay: 6, capitalizeInterest: false },
    );

    expect(result.errors.map((error) => [error.eventId, error.code])).toEqual([
      ["D1", "INVALID_AMOUNT"],
      ["R1", "REVERSAL_REFERENCE_MISMATCH"],
      ["R3", "REVERSAL_ALREADY_APPLIED"],
    ]);
    expect(result.ledger.balance("A", 6)).toBe(0n);
    expect(result.ledger.balance("B", 6)).toBe(0n);
  });

  test("does not expose mutable ledger storage", () => {
    const result = replay(accounts, events.slice(0, 2), {
      endDay: 6,
      capitalizeInterest: false,
    });
    const exposedEntries = result.ledger.allEntries() as LedgerEntry[];

    exposedEntries.pop();
    expect(result.ledger.allEntries()).toHaveLength(2);

    const exposedEntry = result.ledger.allEntries()[0] as { amount: bigint };
    expect(() => {
      exposedEntry.amount = 0n;
    }).toThrow();
    expect(result.ledger.balance("ACC-001", 1)).toBe(25000n);
  });
});
