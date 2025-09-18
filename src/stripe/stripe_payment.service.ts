import { Injectable } from "@nestjs/common";
import { callHTTPException } from "src/shared/exceptions";
import { checkoutSessionDto } from "./dto/stripe.dto";
import { Env } from "../shared/config";

const { Stripe } = require("stripe");
import { Request } from "express";

import { AuthService } from "src/auth/auth.service";
import { VisaService } from "src/visaApis/visaApi.service";

// Utility function to filter sensitive data from checkout data for logging
function filterCheckoutDataForLogging(data: any): any {
  if (!data) return data;

  const filtered = { ...data };

  // Filter travelers data if it exists
  if (filtered.travelers && Array.isArray(filtered.travelers)) {
    filtered.travelers = filtered.travelers.map((traveler) => {
      const filteredTraveler = { ...traveler };
      if (filteredTraveler.passportFront) {
        filteredTraveler.passportFront = "[BASE64_IMAGE_DATA_REMOVED]";
      }
      if (filteredTraveler.passportBack) {
        filteredTraveler.passportBack = "[BASE64_IMAGE_DATA_REMOVED]";
      }
      if (filteredTraveler.insuranceCertificate) {
        filteredTraveler.insuranceCertificate = "[BASE64_IMAGE_DATA_REMOVED]";
      }

      // Filter document images
      if (
        filteredTraveler.documents &&
        typeof filteredTraveler.documents === "object"
      ) {
        Object.keys(filteredTraveler.documents).forEach((docKey) => {
          if (
            typeof filteredTraveler.documents[docKey] === "string" &&
            filteredTraveler.documents[docKey].startsWith("data:")
          ) {
            filteredTraveler.documents[docKey] = "[BASE64_IMAGE_DATA_REMOVED]";
          }
        });
      }

      return filteredTraveler;
    });
  }

  // Filter any nested traveler data
  Object.keys(filtered).forEach((key) => {
    if (typeof filtered[key] === "object" && filtered[key] !== null) {
      if (key.includes("traveler") || key.includes("Traveler")) {
        filtered[key] = filterCheckoutDataForLogging(filtered[key]);
      }
    }
  });

  return filtered;
}
import { VisaApplicationService } from "src/applicationSteps/visa-application.service";
import { VisaApplicationStepType } from "src/applicationSteps/dto/visa-application.dto";

@Injectable()
export class StripeService {
  constructor(
    private readonly authService: AuthService,
    private readonly visaService: VisaService,
    private readonly visaApplicationService: VisaApplicationService
  ) {}

  async createCheckoutSession(checkoutData: checkoutSessionDto): Promise<any> {
    try {
      console.log("=== PAYMENT SESSION CREATION DEBUG ===");
      console.log(
        "Received checkout data:",
        JSON.stringify(filterCheckoutDataForLogging(checkoutData), null, 2)
      );

      const stripe = Stripe(Env.stripeSecretKey);

      let { email, amount, successUrl, cancelUrl, paymentType } = checkoutData;

      const amountInCents = Math.round(Number(amount) * 100);

      console.log("Converted amount to cents:", amountInCents);

      const customerEmail = email ? { customer_email: email } : {};

      let authResponse = {};

      // Only create new session for application creation payments
      // For insurance payments, reuse existing session since user is already authenticated
      if (paymentType === "application_creation" || !paymentType) {
        console.log("Creating new auth session for application creation");
        const loginDto = {
          email: email,
          sessionUser: true,
        };

        console.log("Calling auth service login...");
        authResponse = await this.authService.login(loginDto);
        console.log("Auth service response:", authResponse);
      } else {
        console.log("Reusing existing session for insurance payment");
        authResponse = {
          message: "Using existing session for insurance payment",
          token: "existing_session_reused",
        };
      }

      console.log(
        "Creating stripe session with metadata:",
        filterCheckoutDataForLogging(checkoutData)
      );

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        ...customerEmail,
        line_items: [
          {
            price_data: {
              currency: "inr",
              product_data: {
                name:
                  paymentType === "additional_traveler_insurance" ||
                  paymentType === "traveler_insurance"
                    ? "Travel Insurance Payment"
                    : "Custom Payment",
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${Env.WEBSITE_URL}${successUrl}`,
        cancel_url: `${Env.WEBSITE_URL}${cancelUrl}`,
        metadata: {
          ...checkoutData,
        },
      });

      console.log("Stripe session created successfully:", session);
      console.log("=== END PAYMENT SESSION CREATION DEBUG ===");

      return { url: session.url, ...authResponse };
    } catch (err) {
      console.log("=== PAYMENT SESSION CREATION ERROR ===");
      console.log("Error details:", err);
      console.log("Error message:", err.message);
      console.log("Error stack:", err.stack);
      console.log("=== END PAYMENT SESSION CREATION ERROR ===");
      callHTTPException(
        `Something went wrong while generating sessionId: ${err.message}`
      );
    }
  }

  async handleWebhook(req: Request & { rawBody: Buffer }) {
    console.log("=== WEBHOOK SERVICE CALLED ===");
    console.log("Webhook headers:", req.headers);
    console.log("Webhook body length:", req.rawBody?.length || 0);

    try {
      const stripe = new Stripe(Env.stripeSecretKey, {
        apiVersion: "2020-08-27",
      });
      const signature = req.headers["stripe-signature"];
      console.log("Stripe signature present:", !!signature);

      let event;
      try {
        // Verify the event by checking the signature
        console.log("Constructing webhook event...");
        event = stripe.webhooks.constructEvent(
          req.rawBody,
          signature,
          Env.Webhook_Secret
        );
        console.log("Webhook event constructed successfully:", event.type);
      } catch (err) {
        console.error("Webhook signature verification failed:", err.message);
        callHTTPException(err.message);
      }

      const visaApiToken = await this.visaService.generateToken();

      const session = event.data.object;

      switch (event.type) {
        case "invoice.created":
          break;

        case "invoice.finalized":
          break;

        case "invoice.voided":
          break;

        case "checkout.session.completed":
          await this.handlePaymentSuccess(event["data"]["object"]);
          break;

        case "invoice.payment_failed":
          break;

        default:
          break;
      }

      return {
        message: "Webhook successfully processed.",
        event_type: event.type,
      };
    } catch (err) {
      callHTTPException(err.message);
    }
  }

  async handlePaymentSuccess(data) {
    try {
      console.log("=== PAYMENT SUCCESS WEBHOOK ===");
      console.log("Payment metadata:", JSON.stringify(data.metadata, null, 2));
      console.log("Customer email:", data.customer_email);

      // Check if this is a traveler insurance payment (regular or additional)
      if (
        data.metadata.paymentType === "additional_traveler_insurance" ||
        data.metadata.paymentType === "traveler_insurance"
      ) {
        console.log("=== WEBHOOK INSURANCE PAYMENT PROCESSING ===");
        console.log(
          `Processing ${data.metadata.paymentType} payment for traveler ${data.metadata.travelerIndex}`
        );
        console.log(
          "Raw travelerIndex from metadata:",
          data.metadata.travelerIndex
        );
        console.log(
          "Parsed travelerIndex:",
          parseInt(data.metadata.travelerIndex)
        );
        console.log("Application ID:", data.metadata.applicationId);

        // Update the specific traveler's insurance status
        const updateResult =
          await this.visaApplicationService.createOrUpdateApplication({
            type: VisaApplicationStepType.INSURANCE,
            applicationId: data.metadata.applicationId,
            currentTravelerIndex: parseInt(data.metadata.travelerIndex),
            insurance: "true",
            email: data.metadata.email,
            amountPaid: data.metadata.amount,
            paymentType: data.metadata.paymentType,
          });

        console.log("Traveler insurance update result:", updateResult);
        console.log("=== END WEBHOOK INSURANCE PAYMENT PROCESSING ===");
      } else {
        console.log("Processing application creation payment");
        // Original application creation payment
        await this.visaApplicationService.createOrUpdateApplication({
          type: VisaApplicationStepType.CREATE_APPLICATION,
          email: data.metadata.email,
          insurance: data.metadata.insurance,
          numberOfTravellers: data.metadata.travellers,
          amountPaid: data.metadata.amount,
          country: data.metadata.country,
          visaTypeId: data.metadata.visaTypeId,
        });
      }

      const email = data.customer_email;
      console.log("=== END PAYMENT SUCCESS WEBHOOK ===");
    } catch (err) {
      console.error("Payment success handling error:", err);
      callHTTPException(err.message);
    }
  }
}
