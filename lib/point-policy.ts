export const PAYMENT_PURPOSES = ["MOBILE_ORDER", "STUDIO_USAGE", "RESIDENT_SUBSCRIPTION"] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

/**
 * Point eligibility is determined by what was purchased, never by Stripe itself.
 * Keeping this rule server-side prevents a client or webhook payload from awarding
 * points for resident subscriptions.
 */
export function isPointEligible(purpose: PaymentPurpose) {
  return purpose === "MOBILE_ORDER" || purpose === "STUDIO_USAGE";
}

export function pointRuleFor(purpose: PaymentPurpose) {
  return {
    purpose,
    eligible: isPointEligible(purpose),
    ledger: "SMAREGI" as const,
    paymentLabel: "スマート決済",
  };
}
