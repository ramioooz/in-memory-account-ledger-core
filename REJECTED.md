# Rejected Outcomes and Approaches

## Rejected criteria

### Criterion #2: E7 causes exactly one fee on Day 2

Rejected. E7 makes the account close negative on Days 2, 4 and 5 after the fee cascade is carried forward. It therefore causes three AED 25 fees.

### Criterion #6: E9 returns balances and fees to their pre-E7 values

Rejected. E9 reverses only E7's AED 620 principal. No rule or event appends compensating entries for the three previously posted fees. Append-only history would allow explicit compensation, but none is supplied here.

### Criterion #7: all three BHD installments equal 3.334

Rejected. Three installments of BHD 3.334 total BHD 10.002. The conserving split is BHD 3.334, BHD 3.333 and BHD 3.333.

### Criterion #8: discard an unmatched interest remainder

Rejected. The capitalized total is defined as the sum of the rounded daily accruals, so there is no separate unmatched remainder to discard.

## Rejected implementation approaches

- Mutating a stored balance was rejected in favor of deriving balances from immutable entries.
- Sorting the source stream by value day was rejected because it would change arrival-time authorization decisions.
- Removing fees during E9 was rejected because the reversal names E7 only.
- Rounding interest only after aggregating exact fractions was rejected because daily accruals must sum to capitalization.
- Producing three identical BHD installments was rejected because it cannot conserve BHD 10.000 at three-decimal precision.
