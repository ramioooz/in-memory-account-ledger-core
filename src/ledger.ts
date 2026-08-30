import type { LedgerEntry } from "./types.js";

export class Ledger {
  readonly #entries: LedgerEntry[] = [];

  append(entry: Omit<LedgerEntry, "id">): LedgerEntry {
    const appended = {
      ...entry,
      id: `L${String(this.#entries.length + 1).padStart(4, "0")}`,
    };
    this.#entries.push(appended);
    return appended;
  }

  balance(accountId: string, throughDay: number): bigint {
    return this.#entries.reduce(
      (total, entry) =>
        entry.accountId === accountId && entry.valueDay <= throughDay
          ? total + entry.amount
          : total,
      0n,
    );
  }

  allEntries(): readonly LedgerEntry[] {
    return this.#entries;
  }
}
