export type Currency = "AED" | "BHD";
export type Day = 1 | 2 | 3 | 4 | 5 | 6;

export interface AccountConfig {
  readonly id: string;
  readonly currency: Currency;
}

interface BaseEvent {
  readonly id: string;
  readonly eventDay: Day;
  readonly valueDay: Day;
  readonly accountId: string;
  readonly currency: Currency;
}

export interface CreditEvent extends BaseEvent {
  readonly type: "CREDIT";
  readonly amount: bigint;
  readonly installments?: number;
}

export interface DebitEvent extends BaseEvent {
  readonly type: "DEBIT";
  readonly amount: bigint;
}

export interface AuthorizationEvent extends BaseEvent {
  readonly type: "AUTHORIZATION";
  readonly authorizationId: string;
  readonly holdAmount: bigint;
}

export interface SettlementEvent extends BaseEvent {
  readonly type: "SETTLEMENT";
  readonly authorizationId: string;
  readonly amount: bigint;
}

export interface ReversalEvent extends BaseEvent {
  readonly type: "REVERSAL";
  readonly reversesEventId: string;
}

export type SourceEvent =
  | CreditEvent
  | DebitEvent
  | AuthorizationEvent
  | SettlementEvent
  | ReversalEvent;

export type EntryType =
  | "CREDIT"
  | "DEBIT"
  | "SETTLEMENT"
  | "REVERSAL"
  | "OVERDRAFT_FEE"
  | "INTEREST";

export interface LedgerEntry {
  readonly id: string;
  readonly sourceEventId: string;
  readonly accountId: string;
  readonly currency: Currency;
  readonly amount: bigint;
  readonly valueDay: Day;
  readonly type: EntryType;
}

export interface AuthorizationRecord {
  readonly authorizationId: string;
  readonly accountId: string;
  readonly currency: Currency;
  readonly holdAmount: bigint;
  readonly availableBalanceAtDecision: bigint;
  status: "ACTIVE" | "SETTLED" | "REJECTED";
  decisionDay: Day;
  settledDay?: Day;
  settledAmount?: bigint;
  rejectionReason?: "INSUFFICIENT_AVAILABLE_BALANCE";
}

export interface ReplayError {
  readonly eventId: string;
  readonly eventDay: Day;
  readonly accountId: string;
  readonly code: string;
  readonly message: string;
  readonly authorizationId?: string;
}

export interface InterestAccrual {
  readonly accountId: string;
  readonly currency: Currency;
  readonly day: Day;
  readonly amount: bigint;
}
