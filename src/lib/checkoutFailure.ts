export type CheckoutFailureCode = "configuration" | "unavailable" | "failed";

const messages: Record<CheckoutFailureCode, string> = {
  configuration: "Payments are temporarily unavailable. Please contact us for help starting your plan.",
  unavailable: "We couldn’t reach the payment service. Please try again shortly.",
  failed: "We couldn’t open checkout. Please try again or contact us for help.",
};

export function checkoutFailureMessage(code: string | null): string | null {
  return code && Object.hasOwn(messages, code) ? messages[code as CheckoutFailureCode] : null;
}
