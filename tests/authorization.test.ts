import { describe, expect, test } from "vitest";

import { activeHoldAtDay, replay } from "../src/replay.js";
import { accounts, events } from "../src/scenario.js";

describe("authorization replay", () => {
  test("holds available funds until a matching settlement", () => {
    const result = replay(accounts, events.slice(0, 6), {
      endDay: 6,
      capitalizeInterest: false,
    });
    const authA = result.authorizations.get("Auth-A");

    expect(authA).toBeDefined();
    expect(authA?.status).toBe("SETTLED");
    expect(authA?.holdAmount).toBe(20000n);
    expect(authA?.settledDay).toBe(4);
    expect(activeHoldAtDay(authA!, 2)).toBe(20000n);
    expect(result.ledger.balance("ACC-001", 2) - activeHoldAtDay(authA!, 2)).toBe(
      5000n,
    );

    const settlement = result.ledger
      .allEntries()
      .find((entry) => entry.sourceEventId === "E5");
    expect(settlement?.amount).toBe(-18500n);
  });

  test("records an unknown settlement without changing the ledger", () => {
    const result = replay(accounts, events.slice(0, 6), {
      endDay: 6,
      capitalizeInterest: false,
    });

    expect(result.errors).toEqual([
      expect.objectContaining({
        eventId: "E6",
        code: "AUTHORIZATION_NOT_FOUND",
      }),
    ]);
    expect(
      result.ledger.allEntries().some((entry) => entry.sourceEventId === "E6"),
    ).toBe(false);
  });

  test("rejects Auth-B when the known Day 5 balance cannot cover its hold", () => {
    const result = replay(accounts, events.slice(0, 9), {
      endDay: 6,
      capitalizeInterest: false,
    });
    const authB = result.authorizations.get("Auth-B");

    expect(authB?.status).toBe("REJECTED");
    expect(authB?.rejectionReason).toBe("INSUFFICIENT_AVAILABLE_BALANCE");
    expect(activeHoldAtDay(authB!, 5)).toBe(0n);
  });
});
