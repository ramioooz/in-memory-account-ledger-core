import type { AccountConfig, SourceEvent } from "./types.js";

export const accounts: readonly AccountConfig[] = [
  { id: "ACC-001", currency: "AED" },
  { id: "ACC-002", currency: "BHD" },
];

export const events: readonly SourceEvent[] = [
  {
    id: "E1",
    type: "CREDIT",
    eventDay: 1,
    valueDay: 1,
    accountId: "ACC-001",
    currency: "AED",
    amount: 120000n,
  },
  {
    id: "E2",
    type: "DEBIT",
    eventDay: 1,
    valueDay: 1,
    accountId: "ACC-001",
    currency: "AED",
    amount: 95000n,
  },
  {
    id: "E3",
    type: "AUTHORIZATION",
    eventDay: 2,
    valueDay: 2,
    accountId: "ACC-001",
    currency: "AED",
    authorizationId: "Auth-A",
    holdAmount: 20000n,
  },
  {
    id: "E4",
    type: "CREDIT",
    eventDay: 3,
    valueDay: 3,
    accountId: "ACC-001",
    currency: "AED",
    amount: 40000n,
  },
  {
    id: "E5",
    type: "SETTLEMENT",
    eventDay: 4,
    valueDay: 4,
    accountId: "ACC-001",
    currency: "AED",
    authorizationId: "Auth-A",
    amount: 18500n,
  },
  {
    id: "E6",
    type: "SETTLEMENT",
    eventDay: 4,
    valueDay: 4,
    accountId: "ACC-001",
    currency: "AED",
    authorizationId: "Auth-Z",
    amount: 18000n,
  },
];
