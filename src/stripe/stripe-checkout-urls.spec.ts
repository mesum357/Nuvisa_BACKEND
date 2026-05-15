import {
  buildAbsoluteCheckoutUrl,
  resolveCheckoutRedirectUrls,
} from "./stripe-checkout-urls";

describe("buildAbsoluteCheckoutUrl", () => {
  it("joins relative paths to the origin once", () => {
    expect(
      buildAbsoluteCheckoutUrl(
        "https://www.nuvisa.co.uk/",
        "/visa-checkout",
        "/payment-success"
      )
    ).toBe("https://www.nuvisa.co.uk/visa-checkout");
  });

  it("does not prepend the origin to an absolute URL", () => {
    expect(
      buildAbsoluteCheckoutUrl(
        "https://www.nuvisa.co.uk",
        "https://www.nuvisa.co.uk/visa-checkout",
        "/payment-success"
      )
    ).toBe("https://www.nuvisa.co.uk/visa-checkout");
  });
});

describe("resolveCheckoutRedirectUrls", () => {
  it("uses payment success for success and visa checkout for cancel", () => {
    expect(
      resolveCheckoutRedirectUrls(
        {
          successUrl: "/payment-success",
          cancelUrl: "/visa-checkout",
        },
        "https://www.nuvisa.co.uk"
      )
    ).toEqual({
      successUrl: "https://www.nuvisa.co.uk/payment-success",
      cancelUrl: "https://www.nuvisa.co.uk/visa-checkout",
    });
  });

  it("keeps absolute cancel URLs absolute for Klarna return-to-store", () => {
    expect(
      resolveCheckoutRedirectUrls(
        {
          successUrl: "/payment-success",
          cancelUrl: "https://www.nuvisa.co.uk/visa-checkout",
        },
        "https://www.nuvisa.co.uk"
      ).cancelUrl
    ).toBe("https://www.nuvisa.co.uk/visa-checkout");
  });

  it("does not allow application-step as the cancel/back destination", () => {
    expect(
      resolveCheckoutRedirectUrls(
        {
          successUrl: "/payment-success",
          cancelUrl: "/application-step?application_id=123",
        },
        "https://www.nuvisa.co.uk"
      ).cancelUrl
    ).toBe("https://www.nuvisa.co.uk/visa-checkout");
  });
});
