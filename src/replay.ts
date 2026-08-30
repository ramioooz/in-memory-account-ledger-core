import { Ledger } from "./ledger.js";
import { roundRatio, splitEvenly } from "./money.js";
import type {
  AccountConfig,
  AuthorizationRecord,
  Day,
  InterestAccrual,
  ReplayError,
  SourceEvent,
} from "./types.js";

export interface ReplayOptions {
  readonly endDay: Day;
  readonly capitalizeInterest: boolean;
}

export interface ReplayResult {
  readonly ledger: Ledger;
  readonly authorizations: ReadonlyMap<string, AuthorizationRecord>;
  readonly errors: readonly ReplayError[];
  readonly interestAccruals: readonly InterestAccrual[];
}

export const OVERDRAFT_FEE_AED = 2500n;
export const DAILY_INTEREST_NUMERATOR = 4n;
export const DAILY_INTEREST_DENOMINATOR = 10000n;

export function activeHoldAtDay(
  authorization: AuthorizationRecord,
  day: Day,
): bigint {
  if (
    authorization.status === "REJECTED" ||
    day < authorization.decisionDay ||
    (authorization.settledDay !== undefined && day >= authorization.settledDay)
  ) {
    return 0n;
  }

  return authorization.holdAmount;
}

export function availableBalanceAt(
  result: ReplayResult,
  accountId: string,
  day: Day,
): bigint {
  const holds = [...result.authorizations.values()].reduce(
    (total, authorization) =>
      authorization.accountId === accountId
        ? total + activeHoldAtDay(authorization, day)
        : total,
    0n,
  );
  return result.ledger.balance(accountId, day) - holds;
}

export function replay(
  accounts: readonly AccountConfig[],
  events: readonly SourceEvent[],
  options: ReplayOptions,
): ReplayResult {
  const ledger = new Ledger();
  const authorizations = new Map<string, AuthorizationRecord>();
  const errors: ReplayError[] = [];
  const accountCurrencies = new Map(
    accounts.map((account) => [account.id, account.currency]),
  );
  const assessedFees = new Set<string>();
  const reversedEventIds = new Set<string>();
  const interestAccruals: InterestAccrual[] = [];

  const recordError = (
    event: SourceEvent,
    code: string,
    message: string,
  ): void => {
    errors.push({
      eventId: event.id,
      eventDay: event.eventDay,
      accountId: event.accountId,
      code,
      message,
    });
  };

  const assessFeesThrough = (accountId: string, throughDay: Day): void => {
    if (accountCurrencies.get(accountId) !== "AED") {
      return;
    }

    for (let day = 1; day <= throughDay; day += 1) {
      const valueDay = day as Day;
      const key = `${accountId}:${valueDay}`;

      if (!assessedFees.has(key) && ledger.balance(accountId, valueDay) < 0n) {
        ledger.append({
          sourceEventId: `FEE-${accountId}-D${valueDay}`,
          accountId,
          currency: "AED",
          amount: -OVERDRAFT_FEE_AED,
          valueDay,
          type: "OVERDRAFT_FEE",
        });
        assessedFees.add(key);
      }
    }
  };

  for (const event of events) {
    if (accountCurrencies.get(event.accountId) !== event.currency) {
      recordError(
        event,
        "ACCOUNT_OR_CURRENCY_INVALID",
        "The event account or currency is invalid",
      );
      continue;
    }

    const amount =
      event.type === "AUTHORIZATION"
        ? event.holdAmount
        : event.type === "REVERSAL"
          ? undefined
          : event.amount;

    if (amount !== undefined && amount <= 0n) {
      recordError(event, "INVALID_AMOUNT", "The event amount must be positive");
      continue;
    }

    if (
      event.type === "CREDIT" &&
      event.installments !== undefined &&
      (!Number.isSafeInteger(event.installments) || event.installments <= 0)
    ) {
      recordError(
        event,
        "INVALID_INSTALLMENTS",
        "Installments must be a positive integer",
      );
      continue;
    }

    if (event.type === "CREDIT" || event.type === "DEBIT") {
      const amounts =
        event.type === "CREDIT" && event.installments !== undefined
          ? splitEvenly(event.amount, event.installments)
          : [event.type === "CREDIT" ? event.amount : -event.amount];

      for (const amount of amounts) {
        ledger.append({
          sourceEventId: event.id,
          accountId: event.accountId,
          currency: event.currency,
          amount,
          valueDay: event.valueDay,
          type: event.type,
        });
      }
      assessFeesThrough(event.accountId, event.eventDay);
      continue;
    }

    if (event.type === "AUTHORIZATION") {
      if (authorizations.has(event.authorizationId)) {
        recordError(
          event,
          "DUPLICATE_AUTHORIZATION",
          `Authorization ${event.authorizationId} already exists`,
        );
        continue;
      }

      const activeHolds = [...authorizations.values()].reduce(
        (total, authorization) =>
          authorization.accountId === event.accountId &&
          authorization.status === "ACTIVE"
            ? total + authorization.holdAmount
            : total,
        0n,
      );
      const available =
        ledger.balance(event.accountId, event.eventDay) - activeHolds;
      const approved = available >= event.holdAmount;

      authorizations.set(event.authorizationId, {
        authorizationId: event.authorizationId,
        accountId: event.accountId,
        currency: event.currency,
        holdAmount: event.holdAmount,
        status: approved ? "ACTIVE" : "REJECTED",
        decisionDay: event.eventDay,
        ...(approved
          ? {}
          : { rejectionReason: "INSUFFICIENT_AVAILABLE_BALANCE" as const }),
      });
      continue;
    }

    if (event.type === "SETTLEMENT") {
      const authorization = authorizations.get(event.authorizationId);

      if (!authorization || authorization.status !== "ACTIVE") {
        recordError(
          event,
          "AUTHORIZATION_NOT_FOUND",
          `No active authorization found for ${event.authorizationId}`,
        );
        continue;
      }

      if (
        authorization.accountId !== event.accountId ||
        authorization.currency !== event.currency
      ) {
        recordError(
          event,
          "AUTHORIZATION_REFERENCE_MISMATCH",
          `Authorization ${event.authorizationId} belongs to another account or currency`,
        );
        continue;
      }

      ledger.append({
        sourceEventId: event.id,
        accountId: event.accountId,
        currency: event.currency,
        amount: -event.amount,
        valueDay: event.valueDay,
        type: "SETTLEMENT",
      });
      authorization.status = "SETTLED";
      authorization.settledDay = event.eventDay;
      assessFeesThrough(event.accountId, event.eventDay);
      continue;
    }

    const reversedEntries = ledger
      .allEntries()
      .filter((entry) => entry.sourceEventId === event.reversesEventId);

    if (reversedEntries.length === 0) {
      recordError(
        event,
        "REVERSAL_TARGET_NOT_FOUND",
        `No ledger entry found for ${event.reversesEventId}`,
      );
      continue;
    }

    if (
      reversedEntries.some(
        (entry) =>
          entry.accountId !== event.accountId ||
          entry.currency !== event.currency,
      )
    ) {
      recordError(
        event,
        "REVERSAL_REFERENCE_MISMATCH",
        `Reversal target ${event.reversesEventId} belongs to another account or currency`,
      );
      continue;
    }

    if (reversedEventIds.has(event.reversesEventId)) {
      recordError(
        event,
        "REVERSAL_ALREADY_APPLIED",
        `Event ${event.reversesEventId} has already been reversed`,
      );
      continue;
    }

    for (const reversedEntry of reversedEntries) {
      ledger.append({
        sourceEventId: event.id,
        accountId: event.accountId,
        currency: event.currency,
        amount: -reversedEntry.amount,
        valueDay: event.valueDay,
        type: "REVERSAL",
      });
    }
    reversedEventIds.add(event.reversesEventId);
    assessFeesThrough(event.accountId, event.eventDay);
  }

  for (const account of accounts) {
    assessFeesThrough(account.id, options.endDay);
  }

  if (options.capitalizeInterest) {
    for (const account of accounts) {
      for (let day = 1; day <= options.endDay; day += 1) {
        const valueDay = day as Day;
        const closingBalance = ledger.balance(account.id, valueDay);

        if (closingBalance <= 0n) {
          continue;
        }

        interestAccruals.push({
          accountId: account.id,
          currency: account.currency,
          day: valueDay,
          amount: roundRatio(
            closingBalance,
            DAILY_INTEREST_NUMERATOR,
            DAILY_INTEREST_DENOMINATOR,
          ),
        });
      }

      const capitalization = interestAccruals
        .filter((accrual) => accrual.accountId === account.id)
        .reduce((total, accrual) => total + accrual.amount, 0n);

      if (capitalization > 0n) {
        ledger.append({
          sourceEventId: `INTEREST-${account.id}`,
          accountId: account.id,
          currency: account.currency,
          amount: capitalization,
          valueDay: options.endDay,
          type: "INTEREST",
        });
      }
    }
  }

  return {
    ledger,
    authorizations,
    errors,
    interestAccruals,
  };
}
