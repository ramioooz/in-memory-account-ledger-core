import { describe, expect, test } from "vitest";

import { replay } from "../src/replay.js";
import { accounts, events } from "../src/scenario.js";

describe("complete scenario", () => {
  test("conserves installments and produces the final Day 6 balances", () => {
    const result = replay(accounts, events, {
      endDay: 6,
      capitalizeInterest: true,
    });
    const installments = result.ledger
      .allEntries()
      .filter((entry) => entry.sourceEventId === "E10");

    expect(installments.map((entry) => entry.amount)).toEqual([
      3334n,
      3333n,
      3333n,
    ]);
    expect(installments.reduce((total, entry) => total + entry.amount, 0n)).toBe(
      10000n,
    );
    expect(result.ledger.balance("ACC-001", 6)).toBe(39093n);
    expect(result.ledger.balance("ACC-002", 6)).toBe(10008n);
  });
});
