# Ambiguities

## Arrival order and value day

The source stream is processed exactly as supplied. It is not sorted by `valueDay`. Processing decisions use information known when an event arrives, while financial balances are derived from the value dates on appended entries.

## Late entries and daily fees

When E7 arrives on Day 5 with Day 2 value, daily closes are recalculated from Day 2 forward. A fee is appended once for each newly discovered negative close. The fee itself affects later closes, producing fees on Days 2, 4 and 5.

## Reversal and previously posted fees

E9 explicitly reverses E7's principal. No event or rule reverses the fees already appended because of E7, so those entries remain. A separate compensating fee event would be required to change that result.

## Authorization decisions after restatement

Authorization decisions are not rerun after a later event restates history. E8 is rejected because the balance known at its arrival cannot cover the AED 90 hold; E9 does not retroactively approve it.

## Settlement amount validation

The requirements do not define zero or negative settlement amounts. This implementation treats settlement as an actual financial debit, so it rejects amounts less than or equal to zero with `INVALID_AMOUNT` before changing the ledger or authorization. Releasing a hold without capturing funds would typically use a separate release or void event, which is not part of the supplied event model and remains outside this project's scope.

## Interest rounding convention

The requirement explicitly defines the capitalized total as the sum of the rounded daily accruals. It does not specify whether an exact halfway value should round up or down. This implementation rounds each positive daily accrual to the nearest minor unit, with exact halves away from zero, before summing them.

## End-of-replay finalization

E10 has Day 5 as both its event and value day but appears after the Day 6 event. The replay therefore finishes the supplied stream before explicitly finalizing every account through Day 6 and calculating interest.
