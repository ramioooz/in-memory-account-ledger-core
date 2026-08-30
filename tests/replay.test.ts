import { describe, expect, test } from "vitest";

import { replay } from "../src/replay.js";
import { accounts, events } from "../src/scenario.js";

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
});
