import type { AccountConfig, Day, SourceEvent } from "../src/types.js";

export const validationAccounts = [
  { id: "A", currency: "AED" },
  { id: "B", currency: "AED" },
] as const satisfies readonly AccountConfig[];

export function credit(
  id: string,
  accountId: string,
  amount: bigint,
  eventDay: Day = 1,
  valueDay: Day = eventDay,
): SourceEvent {
  return {
    id,
    type: "CREDIT",
    eventDay,
    valueDay,
    accountId,
    currency: "AED",
    amount,
  };
}

export function debit(id: string, amount: bigint): SourceEvent {
  return {
    id,
    type: "DEBIT",
    eventDay: 1,
    valueDay: 1,
    accountId: "A",
    currency: "AED",
    amount,
  };
}

export function authorization(
  id: string,
  authorizationId: string,
  holdAmount: bigint,
  accountId = "A",
  eventDay: Day = 2,
): SourceEvent {
  return {
    id,
    type: "AUTHORIZATION",
    eventDay,
    valueDay: eventDay,
    accountId,
    currency: "AED",
    authorizationId,
    holdAmount,
  };
}

export function settlement(
  id: string,
  authorizationId: string,
  accountId: string,
  eventDay: Day = 3,
): SourceEvent {
  return {
    id,
    type: "SETTLEMENT",
    eventDay,
    valueDay: eventDay,
    accountId,
    currency: "AED",
    authorizationId,
    amount: 5000n,
  };
}

export function reversal(
  id: string,
  reversesEventId: string,
  accountId: string,
  eventDay: Day,
): SourceEvent {
  return {
    id,
    type: "REVERSAL",
    eventDay,
    valueDay: 1,
    accountId,
    currency: "AED",
    reversesEventId,
  };
}
