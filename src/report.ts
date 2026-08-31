import { formatMoney } from "./money.js";
import { activeHoldAtDay, availableBalanceAt } from "./replay.js";
import type { ReplayResult } from "./replay.js";
import type {
  AccountConfig,
  AuthorizationRecord,
  Currency,
  Day,
  ReplayError,
} from "./types.js";

export interface AuthorizationSummary {
  readonly authorizationId: string;
  readonly status: "ACTIVE" | "SETTLED" | "REJECTED";
  readonly activeHold: bigint;
  readonly originalHold: bigint;
  readonly availableBalanceAtDecision: bigint;
  readonly settledAmount?: bigint;
  readonly rejectionReason?: "INSUFFICIENT_AVAILABLE_BALANCE";
}

export interface DailyAccountReport {
  readonly day: Day;
  readonly accountId: string;
  readonly currency: Currency;
  readonly ledgerBalance: bigint;
  readonly availableBalance: bigint;
  readonly fees: bigint;
  readonly authorizations: readonly AuthorizationSummary[];
  readonly errors: readonly ReplayError[];
}

function authorizationAtDay(
  authorization: AuthorizationRecord,
  day: Day,
): AuthorizationSummary | undefined {
  if (day < authorization.decisionDay) {
    return undefined;
  }

  const status =
    authorization.status === "REJECTED"
      ? "REJECTED"
      : authorization.settledDay !== undefined && day >= authorization.settledDay
        ? "SETTLED"
        : "ACTIVE";

  return {
    authorizationId: authorization.authorizationId,
    status,
    activeHold: activeHoldAtDay(authorization, day),
    originalHold: authorization.holdAmount,
    availableBalanceAtDecision: authorization.availableBalanceAtDecision,
    ...(authorization.settledAmount === undefined
      ? {}
      : { settledAmount: authorization.settledAmount }),
    ...(authorization.rejectionReason === undefined
      ? {}
      : { rejectionReason: authorization.rejectionReason }),
  };
}

export function buildDailyReports(
  result: ReplayResult,
  accounts: readonly AccountConfig[],
): readonly DailyAccountReport[] {
  const reports: DailyAccountReport[] = [];

  for (const account of accounts) {
    for (let day = 1; day <= 6; day += 1) {
      const valueDay = day as Day;
      const authorizations = [...result.authorizations.values()]
        .filter((authorization) => authorization.accountId === account.id)
        .map((authorization) => authorizationAtDay(authorization, valueDay))
        .filter(
          (authorization): authorization is AuthorizationSummary =>
            authorization !== undefined,
        );

      reports.push({
        day: valueDay,
        accountId: account.id,
        currency: account.currency,
        ledgerBalance: result.ledger.balance(account.id, valueDay),
        availableBalance: availableBalanceAt(result, account.id, valueDay),
        fees: result.ledger
          .allEntries()
          .filter(
            (entry) =>
              entry.accountId === account.id &&
              entry.valueDay === valueDay &&
              entry.type === "OVERDRAFT_FEE",
          )
          .reduce((total, entry) => total + entry.amount, 0n),
        authorizations,
        errors: result.errors.filter(
          (error) =>
            error.accountId === account.id && error.eventDay === valueDay,
        ),
      });
    }
  }

  return reports;
}

export function formatReports(reports: readonly DailyAccountReport[]): string {
  return reports
    .map((report) => {
      const authorizations = report.authorizations.length
        ? report.authorizations
            .map((authorization) => {
              if (
                authorization.status === "SETTLED" &&
                authorization.settledAmount !== undefined
              ) {
                const unusedReleased =
                  authorization.originalHold - authorization.settledAmount;
                return `${authorization.authorizationId}:SETTLED original hold ${report.currency} ${formatMoney(authorization.originalHold, report.currency)} settled ${report.currency} ${formatMoney(authorization.settledAmount, report.currency)} unused hold released ${report.currency} ${formatMoney(unusedReleased, report.currency)}`;
              }

              if (authorization.status === "REJECTED") {
                return `${authorization.authorizationId}:REJECTED attempted hold ${report.currency} ${formatMoney(authorization.originalHold, report.currency)} available at decision ${report.currency} ${formatMoney(authorization.availableBalanceAtDecision, report.currency)} reason ${authorization.rejectionReason}`;
              }

              return `${authorization.authorizationId}:ACTIVE hold ${report.currency} ${formatMoney(authorization.activeHold, report.currency)}`;
            })
            .join(",")
        : "none";
      const errors = report.errors.length
        ? report.errors
            .map((error) => {
              const authorizationId = error.authorizationId
                ? ` authorizationId=${error.authorizationId}`
                : "";
              return `${error.eventId}:${error.code}${authorizationId}`;
            })
            .join(",")
        : "none";

      return [
        `${report.accountId} Day ${report.day}`,
        `ledger ${report.currency} ${formatMoney(report.ledgerBalance, report.currency)}`,
        `available ${report.currency} ${formatMoney(report.availableBalance, report.currency)}`,
        `fees ${report.currency} ${formatMoney(report.fees, report.currency)}`,
        `authorizations ${authorizations}`,
        `errors ${errors}`,
      ].join(" | ");
    })
    .join("\n");
}
