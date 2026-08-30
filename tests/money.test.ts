import { describe, expect, test } from "vitest";

import {
  formatMoney,
  parseMoney,
  roundRatio,
  splitEvenly,
} from "../src/money.js";

describe("money", () => {
  test("parses and formats currency minor units exactly", () => {
    expect(parseMoney("25.00", "AED")).toBe(2500n);
    expect(parseMoney("10.000", "BHD")).toBe(10000n);
    expect(() => parseMoney("1.001", "AED")).toThrow();
    expect(formatMoney(2500n, "AED")).toBe("25.00");
  });

  test("splits an amount without losing minor units", () => {
    expect(splitEvenly(10000n, 3)).toEqual([3334n, 3333n, 3333n]);
  });

  test("rounds an exact ratio to the nearest minor unit", () => {
    expect(roundRatio(41500n, 4n, 10000n)).toBe(17n);
    expect(roundRatio(1n, 1n, 2n)).toBe(1n);
    expect(roundRatio(-1n, 1n, 2n)).toBe(-1n);
  });
});
