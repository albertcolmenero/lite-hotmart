/**
 * Supported charge currencies a creator can pick from.
 *
 * All three are 2-decimal (minor unit = 1/100), so the existing `priceCents`
 * math holds uniformly across the app and Stripe. Adding a zero-decimal
 * currency later (e.g. JPY, KRW) would require special-casing every `* 100` /
 * `/ 100` conversion — don't add one here without that work.
 */
export const SUPPORTED_CURRENCIES = [
  { code: "usd", label: "US Dollar", symbol: "$" },
  { code: "eur", label: "Euro", symbol: "€" },
  { code: "mxn", label: "Mexican Peso", symbol: "MX$" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

export const DEFAULT_CURRENCY: CurrencyCode = "usd";

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return SUPPORTED_CURRENCIES.some((c) => c.code === code);
}

export function currencySymbol(code: string): string {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code)?.symbol ?? "$";
}

export function currencyLabel(code: string): string {
  return (
    SUPPORTED_CURRENCIES.find((c) => c.code === code)?.label ?? code.toUpperCase()
  );
}
