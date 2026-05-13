/**
 * Stripe Checkout only shows payment methods listed in `payment_method_types`.
 * Hosted Klarna requires `klarna` to be included — defaulting to `card` alone shows card UI.
 */
export type CheckoutPaymentMethodInput = {
  paymentMethod?: string;
  payment_method_types?: string[];
  stripePaymentMethodTypes?: string[];
  /** ISO-ish country from checkout (e.g. GB, UK) — used for Klarna + GBP default. */
  country?: string;
  currency?: string;
};

function normalizeToken(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim().toLowerCase();
}

function tokensFromList(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return value.map(normalizeToken).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map(normalizeToken)
      .filter(Boolean);
  }
  return [];
}

/** True if the client explicitly asked for Klarna (any accepted spelling / array entry). */
export function isKlarnaCheckoutRequested(
  input: CheckoutPaymentMethodInput
): boolean {
  if (normalizeToken(input.paymentMethod) === "klarna") return true;
  const combined = [
    ...tokensFromList(input.payment_method_types),
    ...tokensFromList(input.stripePaymentMethodTypes),
  ];
  return combined.includes("klarna");
}

/**
 * Resolves Stripe Checkout `payment_method_types`.
 * Klarna-only session when Klarna is requested (matches product UX); otherwise unchanged card default.
 */
export function resolveStripeCheckoutPaymentMethodTypes(
  input: CheckoutPaymentMethodInput
): string[] {
  if (isKlarnaCheckoutRequested(input)) {
    return ["klarna"];
  }
  return ["card"];
}

/** True when `country` looks like the United Kingdom (common frontend variants). */
export function isLikelyUnitedKingdomCountry(country: unknown): boolean {
  const c = String(country ?? "")
    .trim()
    .toUpperCase();
  return c === "GB" || c === "UK" || c === "UNITED KINGDOM";
}

/**
 * Resolves Checkout `line_items[].price_data.currency`.
 * Klarna UK (Pay in 3) expects GBP — if currency is omitted but Klarna + UK country are set, default `gbp`.
 * Otherwise matches legacy behaviour: EUR when currency is omitted.
 */
export function resolveCheckoutSessionCurrency(
  input: CheckoutPaymentMethodInput
): string {
  const explicit = String(input.currency ?? "")
    .trim()
    .toLowerCase();
  if (explicit) return explicit;
  if (
    isKlarnaCheckoutRequested(input) &&
    isLikelyUnitedKingdomCountry(input.country)
  ) {
    return "gbp";
  }
  return "eur";
}
