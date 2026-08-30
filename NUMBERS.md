# Numbers

All calculations use integer minor units. AED has two decimal places and BHD has three.

## ACC-001 daily results

These are the final restated balances. Day 6 includes the AED 0.93 interest credit.

| Day | Ledger | Available | Fee | Authorization state |
| ---: | ---: | ---: | ---: | --- |
| 1 | AED 250.00 | AED 250.00 | AED 0.00 | — |
| 2 | AED 225.00 | AED 25.00 | AED -25.00 | Auth-A active, AED 200 hold |
| 3 | AED 625.00 | AED 425.00 | AED 0.00 | Auth-A active, AED 200 hold |
| 4 | AED 415.00 | AED 415.00 | AED -25.00 | Auth-A settled |
| 5 | AED 390.00 | AED 390.00 | AED -25.00 | Auth-B rejected |
| 6 | AED 390.93 | AED 390.93 | AED 0.00 | Auth-B rejected |

E7 contributes AED -620.00 on Day 2. Its negative closes append one AED 25 fee on Days 2, 4 and 5. E9 later contributes AED +620.00 on Day 2 without removing those posted fees.

## Interest

The daily rate is exactly `4 / 10000`, or 0.04%. Each positive daily close is rounded to the currency's minor unit before the accruals are summed.

```text
ACC-001: 0.10 + 0.09 + 0.25 + 0.17 + 0.16 + 0.16 = AED 0.93
ACC-002: 0.004 + 0.004 = BHD 0.008
```

Each total is appended once as a Day 6 credit.

## ACC-002 installments

BHD 10.000 is 10,000 minor units. Quotient-and-remainder allocation gives:

```text
BHD 3.334 + BHD 3.333 + BHD 3.333 = BHD 10.000
```

ACC-002 closes Day 5 at BHD 10.000 and Day 6 at BHD 10.008 after interest.
