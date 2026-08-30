import { describe, expect, test } from "vitest";

import { replay } from "../src/replay.js";
import { buildDailyReports, formatReports } from "../src/report.js";
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

  test("reports restated ledger and historical available balances", () => {
    const result = replay(accounts, events, {
      endDay: 6,
      capitalizeInterest: true,
    });
    const reports = buildDailyReports(result, accounts);
    const acc001 = reports.filter((report) => report.accountId === "ACC-001");
    const acc002 = reports.filter((report) => report.accountId === "ACC-002");

    expect(acc001.map((report) => report.ledgerBalance)).toEqual([
      25000n,
      22500n,
      62500n,
      41500n,
      39000n,
      39093n,
    ]);
    expect(acc001.map((report) => report.availableBalance)).toEqual([
      25000n,
      2500n,
      42500n,
      41500n,
      39000n,
      39093n,
    ]);
    expect(acc001.map((report) => report.fees)).toEqual([
      0n,
      -2500n,
      0n,
      -2500n,
      -2500n,
      0n,
    ]);
    expect(acc001[1]?.authorizations[0]).toEqual(
      expect.objectContaining({
        authorizationId: "Auth-A",
        status: "ACTIVE",
        activeHold: 20000n,
      }),
    );
    expect(acc001[3]?.authorizations[0]).toEqual(
      expect.objectContaining({ status: "SETTLED", activeHold: 0n }),
    );
    expect(acc001[4]?.authorizations[1]).toEqual(
      expect.objectContaining({
        authorizationId: "Auth-B",
        status: "REJECTED",
        activeHold: 0n,
      }),
    );
    expect(acc001[3]?.errors).toEqual([
      expect.objectContaining({ eventId: "E6" }),
    ]);
    expect(acc002.flatMap((report) => report.errors)).toEqual([]);
    expect(acc002.map((report) => report.ledgerBalance)).toEqual([
      0n,
      0n,
      0n,
      0n,
      10000n,
      10008n,
    ]);

    const output = formatReports(reports);
    expect(output).toContain("ACC-001 Day 6 | ledger AED 390.93");
    expect(output).toContain("ACC-002 Day 6 | ledger BHD 10.008");
  });
});
