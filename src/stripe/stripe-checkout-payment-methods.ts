/**
 * Stripe Checkout only shows payment methods listed in `payment_method_types`.
 * Hosted Klarna requires `klarna` to be included — defaulting to `card` alone shows card UI.
 */
export type CheckoutPaymentMethodInput = {
  paymentMethod?: string;
  payment_method_types?: string[];
  stripePaymentMethodTypes?: string[];
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
