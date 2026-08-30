import type { Currency } from "./types.js";

const currencyScale: Record<Currency, number> = {
  AED: 2,
  BHD: 3,
};

export function parseMoney(value: string, currency: Currency): bigint {
  const scale = currencyScale[currency];
  const match = new RegExp(`^(-?)(\\d+)\\.(\\d{${scale}})$`).exec(value);

  if (!match) {
    throw new Error(`Invalid ${currency} amount: ${value}`);
  }

  const [, sign, whole, fraction] = match;
  const minorUnits = BigInt(`${whole}${fraction}`);
  return sign === "-" ? -minorUnits : minorUnits;
}

export function formatMoney(value: bigint, currency: Currency): string {
  const scale = currencyScale[currency];
  const sign = value < 0n ? "-" : "";
  const digits = (value < 0n ? -value : value).toString().padStart(scale + 1, "0");
  return `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

export function roundRatio(
  value: bigint,
  numerator: bigint,
  denominator: bigint,
): bigint {
  if (denominator <= 0n) {
    throw new Error("Denominator must be positive");
  }

  const product = value * numerator;
  const sign = product < 0n ? -1n : 1n;
  const absolute = product < 0n ? -product : product;
  const quotient = absolute / denominator;
  const remainder = absolute % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  return sign * rounded;
}

export function splitEvenly(total: bigint, parts: number): readonly bigint[] {
  if (!Number.isSafeInteger(parts) || parts <= 0) {
    throw new Error("Parts must be a positive integer");
  }

  const count = BigInt(parts);
  const quotient = total / count;
  const remainder = total % count;

  return Array.from({ length: parts }, (_, index) =>
    BigInt(index) < remainder ? quotient + 1n : quotient,
  );
}
