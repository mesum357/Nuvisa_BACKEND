import { resolveStripeCheckoutPaymentMethodTypes } from "./stripe-checkout-payment-methods";

describe("resolveStripeCheckoutPaymentMethodTypes", () => {
  it("includes klarna when paymentMethod is klarna (case / spacing)", () => {
    expect(
      resolveStripeCheckoutPaymentMethodTypes({
        paymentMethod: "  Klarna ",
      })
    ).toEqual(["klarna"]);
  });

  it("includes klarna when payment_method_types contains klarna", () => {
    expect(
      resolveStripeCheckoutPaymentMethodTypes({
        payment_method_types: ["KLARNA"],
      })
    ).toEqual(["klarna"]);
  });

  it("includes klarna when stripePaymentMethodTypes contains klarna", () => {
    expect(
      resolveStripeCheckoutPaymentMethodTypes({
        stripePaymentMethodTypes: ["klarna"],
      })
    ).toEqual(["klarna"]);
  });

  it("defaults to card when Klarna not requested", () => {
    expect(
      resolveStripeCheckoutPaymentMethodTypes({
        paymentMethod: "card",
        payment_method_types: ["card"],
      })
    ).toEqual(["card"]);
    expect(resolveStripeCheckoutPaymentMethodTypes({})).toEqual(["card"]);
  });

  it("Klarna wins when listed alongside card in payment_method_types", () => {
    expect(
      resolveStripeCheckoutPaymentMethodTypes({
        payment_method_types: ["card", "klarna"],
      })
    ).toEqual(["klarna"]);
  });

  it("accepts comma-separated payment_method_types string (defensive)", () => {
    expect(
      resolveStripeCheckoutPaymentMethodTypes({
        payment_method_types: "card,klarna" as unknown as string[],
      })
    ).toEqual(["klarna"]);
  });
});
