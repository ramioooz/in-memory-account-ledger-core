import { buildDailyReports, formatReports } from "./report.js";
import { replay } from "./replay.js";
import { accounts, events } from "./scenario.js";

const result = replay(accounts, events, {
  endDay: 6,
  capitalizeInterest: true,
});

console.log(formatReports(buildDailyReports(result, accounts)));
