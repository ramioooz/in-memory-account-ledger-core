import { expect, test } from "vitest";

import { replay } from "../src/replay.js";
import { accounts, events } from "../src/scenario.js";

test.fails("documents the rejected expectation that E9 removes E7-related fees", () => {
  const result = replay(accounts, events, {
    endDay: 6,
    capitalizeInterest: false,
  });

  // E9 reverses E7's principal only; REJECTED.md explains why posted fees remain.
  expect(
    result.ledger
      .allEntries()
      .filter((entry) => entry.type === "OVERDRAFT_FEE"),
  ).toHaveLength(0);
});
