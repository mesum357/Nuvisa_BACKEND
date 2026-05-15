export const DEFAULT_CHECKOUT_SUCCESS_PATH = "/payment-success";
export const DEFAULT_CHECKOUT_CANCEL_PATH = "/visa-checkout";

export type CheckoutRedirectUrlInput = {
  successUrl?: string;
  cancelUrl?: string;
};

function normalizeCheckoutPath(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/&amp;/g, "&");
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function buildAbsoluteCheckoutUrl(
  origin: string,
  value: unknown,
  fallbackPath: string
): string {
  const normalized = normalizeCheckoutPath(value) || fallbackPath;
  if (isAbsoluteHttpUrl(normalized)) return normalized;

  const cleanOrigin = normalizeCheckoutPath(origin).replace(/\/+$/, "");
  const cleanPath = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `${cleanOrigin}${cleanPath}`;
}

function isApplicationStepUrl(value: string): boolean {
  if (!value) return false;
  if (isAbsoluteHttpUrl(value)) {
    return new URL(value).pathname === "/application-step";
  }
  return value.split("?")[0].replace(/\/+$/, "") === "/application-step";
}

export function resolveCheckoutRedirectUrls(
  input: CheckoutRedirectUrlInput,
  origin: string
): { successUrl: string; cancelUrl: string } {
  const requestedCancelUrl = normalizeCheckoutPath(input.cancelUrl);
  const cancelPath = isApplicationStepUrl(requestedCancelUrl)
    ? DEFAULT_CHECKOUT_CANCEL_PATH
    : requestedCancelUrl || DEFAULT_CHECKOUT_CANCEL_PATH;

  return {
    successUrl: buildAbsoluteCheckoutUrl(
      origin,
      input.successUrl,
      DEFAULT_CHECKOUT_SUCCESS_PATH
    ),
    cancelUrl: buildAbsoluteCheckoutUrl(
      origin,
      cancelPath,
      DEFAULT_CHECKOUT_CANCEL_PATH
    ),
  };
}
