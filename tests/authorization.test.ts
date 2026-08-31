import { describe, expect, test } from "vitest";

import { activeHoldAtDay, replay } from "../src/replay.js";
import { accounts, events } from "../src/scenario.js";
import {
  authorization,
  credit,
  settlement,
  validationAccounts,
} from "./fixtures.js";

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
    expect(
      result.ledger
        .allEntries()
        .find((entry) => entry.sourceEventId === "E5")?.amount,
    ).toBe(-18500n);
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

  test("rejects a settlement that does not match its authorization account", () => {
    const result = replay(
      validationAccounts,
      [
        credit("C1", "A", 10000n),
        authorization("A1", "Auth-X", 5000n),
        settlement("S1", "Auth-X", "B"),
      ],
      { endDay: 6, capitalizeInterest: false },
    );

    expect(result.errors).toEqual([
      expect.objectContaining({
        eventId: "S1",
        code: "AUTHORIZATION_REFERENCE_MISMATCH",
      }),
    ]);
    expect(result.authorizations.get("Auth-X")?.status).toBe("ACTIVE");
    expect(result.ledger.balance("B", 6)).toBe(0n);
  });

  test.each([
    ["zero", 0n],
    ["negative", -1n],
  ])(
    "rejects a %s settlement without changing the ledger or authorization",
    (_label, amount) => {
      const result = replay(
        validationAccounts,
        [
          credit("C1", "A", 10000n),
          authorization("A1", "Auth-X", 5000n),
          settlement("S1", "Auth-X", "A", amount),
        ],
        { endDay: 6, capitalizeInterest: false },
      );

      expect(result.errors).toEqual([
        expect.objectContaining({ eventId: "S1", code: "INVALID_AMOUNT" }),
      ]);
      expect(
        result.ledger
          .allEntries()
          .some((entry) => entry.sourceEventId === "S1"),
      ).toBe(false);
      expect(result.authorizations.get("Auth-X")).toEqual(
        expect.objectContaining({ status: "ACTIVE", holdAmount: 5000n }),
      );
      expect(result.authorizations.get("Auth-X")?.settledDay).toBeUndefined();
      expect(activeHoldAtDay(result.authorizations.get("Auth-X")!, 3)).toBe(
        5000n,
      );
      expect(result.ledger.balance("A", 6)).toBe(10000n);
    },
  );

  test("preserves the original authorization when its ID is reused", () => {
    const result = replay(
      validationAccounts,
      [
        credit("C1", "A", 10000n),
        authorization("A1", "Auth-X", 5000n),
        authorization("A2", "Auth-X", 1000n),
      ],
      { endDay: 6, capitalizeInterest: false },
    );

    expect(result.errors).toEqual([
      expect.objectContaining({
        eventId: "A2",
        code: "DUPLICATE_AUTHORIZATION",
      }),
    ]);
    expect(result.authorizations.get("Auth-X")).toEqual(
      expect.objectContaining({ status: "ACTIVE", holdAmount: 5000n }),
    );
  });

  test("does not rerun a rejected authorization after a late credit", () => {
    const result = replay(
      validationAccounts,
      [
        authorization("A1", "Auth-X", 5000n),
        credit("C1", "A", 10000n, 3, 1),
      ],
      { endDay: 6, capitalizeInterest: false },
    );

    expect(result.authorizations.get("Auth-X")?.status).toBe("REJECTED");
    expect(result.ledger.balance("A", 1)).toBe(10000n);
  });
});
