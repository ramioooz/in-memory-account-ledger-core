import { describe, expect, test } from "vitest";

import { replay } from "../src/replay.js";
import { accounts, events } from "../src/scenario.js";

describe("daily interest", () => {
  test("capitalizes the sum of rounded daily accruals once on Day 6", () => {
    const result = replay(accounts, events, {
      endDay: 6,
      capitalizeInterest: true,
    });
    const acc001Accruals = result.interestAccruals.filter(
      (accrual) => accrual.accountId === "ACC-001",
    );
    const acc001Interest = result.ledger
      .allEntries()
      .find(
        (entry) =>
          entry.accountId === "ACC-001" && entry.type === "INTEREST",
      );

    expect(acc001Accruals.map((accrual) => accrual.amount)).toEqual([
      10n,
      9n,
      25n,
      17n,
      16n,
      16n,
    ]);
    expect(acc001Interest?.amount).toBe(93n);

    const acc002PreInterestBalances = ([5, 6] as const).map((day) =>
      result.ledger
        .allEntries()
        .filter(
          (entry) =>
            entry.accountId === "ACC-002" &&
            entry.type !== "INTEREST" &&
            entry.valueDay <= day,
        )
        .reduce((total, entry) => total + entry.amount, 0n),
    );
    const acc002Accruals = result.interestAccruals.filter(
      (accrual) => accrual.accountId === "ACC-002",
    );
    const acc002Interest = result.ledger
      .allEntries()
      .find(
        (entry) =>
          entry.accountId === "ACC-002" && entry.type === "INTEREST",
      );

    expect(acc002PreInterestBalances).toEqual([10000n, 10000n]);
    expect(acc002Accruals.map((accrual) => accrual.amount)).toEqual([4n, 4n]);
    expect(acc002Interest?.amount).toBe(8n);
  });
});
