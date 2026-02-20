import { Injectable } from "@nestjs/common";
import { callHTTPException } from "src/shared/exceptions";
import { checkoutSessionDto } from "./dto/stripe.dto";
import { Env } from "../shared/config";
import { VisaApplication } from "src/applicationSteps/visa-application.entity";
import { VisaApplicationService } from "src/applicationSteps/visa-application.service";
import { VisaApplicationStepType } from "src/applicationSteps/dto/visa-application.dto";

const { Stripe } = require("stripe");
import { Request } from "express";

import { AuthService } from "src/auth/auth.service";
import { VisaService } from "src/visaApis/visaApi.service";
import { GiftCardService } from "src/gift-card/gift-card.service";

@Injectable()
export class StripeService {
  constructor(
    private readonly authService: AuthService,
    private readonly visaService: VisaService,
    private readonly visaApplicationService: VisaApplicationService,
    private readonly giftCardService: GiftCardService
  ) { }

  async createCheckoutSession(checkoutData: checkoutSessionDto): Promise<any> {
    try {
      const stripe = Stripe(Env.stripeSecretKey);

      let { email, amount, successUrl, cancelUrl, paymentType } = checkoutData;

      const currency = (checkoutData.currency || "EUR")
        .toString()
        .toLowerCase();

      const amountInCents = Math.round(Number(amount) * 100);

      const customerEmail = email ? { customer_email: email } : {};

      let authResponse = {};

      // Handle comma-separated payment types (e.g., "application_creation,gift_card")
      const paymentTypes = paymentType ? paymentType.split(',').map(t => t.trim()) : [];
      const hasApplicationCreation = !paymentType || paymentTypes.includes("application_creation");
      
      if (hasApplicationCreation) {
        const loginDto = {
          email: email,
          sessionUser: true,
        };

        authResponse = await this.authService.login(loginDto, "checkout");


      } else {
        authResponse = {
          message: "Using existing session for insurance payment",
          token: "existing_session_reused",
        };
      }

      const validSuccessUrl = successUrl.replace(/&amp;/g, "&");
      const validCancelUrl = cancelUrl.replace(/&amp;/g, "&");

      // Check if embedded mode is requested
      const isEmbedded = checkoutData.uiMode === "embedded";

      const sessionConfig: any = {
        payment_method_types: ["card"],
        ...customerEmail,
        line_items: [
          {
            price_data: {
              currency: currency,
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
        metadata: {
          ...checkoutData,
        },
      };

      // Configure for embedded or hosted checkout
      if (isEmbedded) {
        sessionConfig.ui_mode = "embedded";
        sessionConfig.return_url = `${Env.WEBSITE_URL}${validSuccessUrl}`;
      } else {
        sessionConfig.success_url = `${Env.WEBSITE_URL}${validSuccessUrl}`;
        sessionConfig.cancel_url = `${Env.WEBSITE_URL}${validCancelUrl}`;
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);

      // Return appropriate response based on mode
      if (isEmbedded) {
        return { 
          clientSecret: session.client_secret, 
          sessionId: session.id,
          ...authResponse 
        };
      } else {
        return { url: session.url, ...authResponse };
      }
    } catch (err) {
      callHTTPException(
        `Something went wrong while generating sessionId: ${err.message}`
      );
    }
  }

  /**
   * Retrieve metadata from a Stripe Checkout Session or Payment Intent.
   * Used by payment-success page to get country, travelers, etc. when localStorage is empty after redirect.
   */
  async getSessionOrPaymentIntentMetadata(paymentId: string): Promise<Record<string, string> | null> {
    if (!paymentId || typeof paymentId !== "string") return null;
    try {
      const stripe = Stripe(Env.stripeSecretKey);
      const id = paymentId.trim();
      if (id.startsWith("cs_")) {
        const session = await stripe.checkout.sessions.retrieve(id, { expand: [] });
        return (session.metadata as Record<string, string>) || null;
      }
      if (id.startsWith("pi_")) {
        const paymentIntent = await stripe.paymentIntents.retrieve(id);
        return (paymentIntent.metadata as Record<string, string>) || null;
      }
      return null;
    } catch (err) {
      console.warn("getSessionOrPaymentIntentMetadata failed:", err?.message);
      return null;
    }
  }

  async createPaymentIntent(checkoutData: checkoutSessionDto): Promise<any> {
    try {
      const stripe = Stripe(Env.stripeSecretKey);

      let { email, amount, paymentType } = checkoutData;

      const currency = (checkoutData.currency || "GBP")
        .toString()
        .toLowerCase();

      const amountInCents = Math.round(Number(amount) * 100);

      let authResponse = {};

      // Handle comma-separated payment types (e.g., "application_creation,gift_card")
      const paymentTypes = paymentType ? paymentType.split(',').map(t => t.trim()) : [];
      const hasApplicationCreation = !paymentType || paymentTypes.includes("application_creation");
      
      if (hasApplicationCreation) {
        const loginDto = {
          email: email,
          sessionUser: true,
        };

        authResponse = await this.authService.login(loginDto, "checkout");
      } else {
        authResponse = {
          message: "Using existing session for insurance payment",
          token: "existing_session_reused",
        };
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency,
        payment_method_types: ["card"],
        metadata: {
          ...checkoutData,
        },
        receipt_email: email,
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: amountInCents,
        currency: currency,
        ...authResponse,
      };
    } catch (err) {
      callHTTPException(
        `Something went wrong while creating payment intent: ${err.message}`
      );
    }
  }

  async handleWebhook(req: Request & { rawBody: Buffer }) {
    try {
      const stripe = new Stripe(Env.stripeSecretKey, {
        apiVersion: "2020-08-27",
      });
      const signature = req.headers["stripe-signature"];

      // Validate that we have the required data for signature verification
      if (!signature) {
        console.error("❌ Stripe webhook signature missing");
        callHTTPException("Missing stripe-signature header");
      }

      if (!req.rawBody) {
        console.error("❌ Raw body missing - this usually means the webhook route is not properly configured");
        console.error("❌ Make sure /stripe_payment/webhook uses express.raw() middleware");
        callHTTPException("Raw request body is required for webhook signature verification");
      }

      if (!Env.Webhook_Secret) {
        console.error("❌ Webhook secret not configured");
        callHTTPException("Webhook secret is not configured");
      }

      // Ensure rawBody is a Buffer (Stripe requires Buffer or string)
      // CRITICAL: If rawBody is an object, it means JSON parsing happened before we captured it
      // This breaks signature verification - we need the EXACT raw bytes
      let rawBody: Buffer;
      if (Buffer.isBuffer(req.rawBody)) {
        rawBody = req.rawBody;
      } else if (typeof req.rawBody === 'string') {
        rawBody = Buffer.from(req.rawBody, 'utf8');
      } else {
        // If it's an object, it's already been parsed - this is a configuration error
        console.error("❌ CRITICAL: Raw body is an object, not a Buffer!");
        console.error("   This means JSON parsing happened before raw body capture.");
        console.error("   The webhook route middleware must capture raw body BEFORE JSON parsing.");
        console.error("   Raw body type:", typeof req.rawBody);
        console.error("   Is Buffer:", Buffer.isBuffer(req.rawBody));
        console.error("   Raw body value:", JSON.stringify(req.rawBody).substring(0, 200));
        callHTTPException("Raw body was parsed as JSON before signature verification. Check middleware order in main.ts");
      }

      // Log verification details before attempting
      console.log("🔍 Webhook verification details:");
      console.log("   Raw body is Buffer:", Buffer.isBuffer(rawBody));
      console.log("   Raw body length:", rawBody.length);
      console.log("   Signature present:", !!signature);
      const sigStr = Array.isArray(signature) ? signature[0] : signature;
      console.log("   Signature preview:", sigStr?.substring(0, 30) + "...");
      console.log("   Webhook secret configured:", !!Env.Webhook_Secret);
      console.log("   Webhook secret starts with:", Env.Webhook_Secret?.substring(0, 40) || "N/A");
      console.log("   Expected to start with: whsec_XdCftjLzGhMYoKiNBggDQSRx3U1spkKO");

      let event;
      try {
        event = stripe.webhooks.constructEvent(
          rawBody,
          signature,
          Env.Webhook_Secret
        );
        console.log("✅ Webhook signature verified successfully!");
        console.log("   Event type:", event.type);
        console.log("   Event ID:", event.id);
      } catch (err) {
        console.error("❌ Stripe webhook signature verification failed");
        console.error("Error details:", err.message);
        console.error("Error type:", err.constructor.name);
        console.error("Signature present:", !!signature);
        console.error("Raw body present:", !!req.rawBody);
        console.error("Raw body is Buffer:", Buffer.isBuffer(req.rawBody));
        console.error("Raw body type:", typeof req.rawBody);
        console.error("Raw body length:", req.rawBody?.length || 0);
        console.error("Webhook secret configured:", !!Env.Webhook_Secret);
        console.error("Webhook secret length:", Env.Webhook_Secret?.length || 0);
        console.error("Webhook secret starts with:", Env.Webhook_Secret?.substring(0, 40) || "N/A");
        
        // Check if it's a secret mismatch
        if (err.message.includes("No signatures found")) {
          console.error("⚠️  This usually means:");
          console.error("   1. Webhook secret doesn't match the endpoint in Stripe Dashboard");
          console.error("   2. A proxy/load balancer modified the request body");
          console.error("   3. Wrong webhook secret (test vs live mode)");
        }
        
        callHTTPException(err.message);
      }

      const _visaApiToken = await this.visaService.generateToken();

      const _session = event.data.object;

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

        case "payment_intent.succeeded":
          // Handle payment intent success (for createPaymentIntent flow)
          const paymentIntent = event["data"]["object"];
          console.log("🔍 Payment Intent Webhook - Full object:", JSON.stringify(paymentIntent, null, 2));
          console.log("🔍 Payment Intent Webhook - Metadata:", JSON.stringify(paymentIntent.metadata || {}, null, 2));
          console.log("🔍 Payment Intent Webhook - Receipt Email:", paymentIntent.receipt_email);
          
          // Convert payment intent structure to match checkout session structure
          // Ensure email is in metadata, fallback to receipt_email if not
          const metadata = paymentIntent.metadata || {};
          if (!metadata.email && paymentIntent.receipt_email) {
            metadata.email = paymentIntent.receipt_email;
          }
          // Ensure amount is in metadata (convert from cents to dollars/pounds)
          if (!metadata.amount && paymentIntent.amount) {
            metadata.amount = (paymentIntent.amount / 100).toString();
          }
          
          const paymentIntentData = {
            id: paymentIntent.id,
            payment_intent: paymentIntent.id,
            metadata: metadata,
            amount_total: paymentIntent.amount, // Amount in cents
            currency: paymentIntent.currency,
            customer_details: {
              email: paymentIntent.receipt_email || metadata.email,
            },
          };
          
          console.log("🔍 Payment Intent Data for handlePaymentSuccess:", JSON.stringify(paymentIntentData, null, 2));
          await this.handlePaymentSuccess(paymentIntentData);
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
      // Parse comma-separated payment types (e.g., "application_creation,gift_card")
      const paymentType = data.metadata?.paymentType || "";
      console.log("🔍 Payment success handler - paymentType:", paymentType);
      console.log("🔍 Payment success handler - metadata:", JSON.stringify(data.metadata || {}));
      
      const paymentTypes = paymentType.split(',').map(t => t.trim()).filter(t => t);
      const hasGiftCard = paymentTypes.includes("gift_card");
      const hasApplicationCreation = paymentTypes.includes("application_creation");
      const hasInsurance = paymentTypes.includes("additional_traveler_insurance") || 
                          paymentTypes.includes("traveler_insurance");
      
      console.log("🔍 Parsed payment types:", { paymentTypes, hasGiftCard, hasApplicationCreation, hasInsurance });

      // Handle gift card purchases (can be combined with other payment types)
      if (hasGiftCard) {
        console.log('✅ Gift card payment detected');
        // Try to get email from multiple sources
        const email = data.metadata?.email || 
                     data.customer_details?.email || 
                     (data.amount_total ? null : null); // Will check receipt_email in payment intent
        // Try to get amount from multiple sources
        let amount = data.metadata?.amount;
        if (!amount && data.amount_total) {
          // Convert from cents to dollars/pounds
          amount = (data.amount_total / 100).toString();
        }
        // Get quantity from metadata (default to 1 if not provided)
        const quantity = data.metadata?.quantity 
          ? parseInt(data.metadata.quantity, 10) 
          : (data.metadata?.noOfGiftCards ? parseInt(data.metadata.noOfGiftCards, 10) : 1);
        const stripeSessionId = data.id || null;
        const stripePaymentIntentId = data.payment_intent || data.id || null;
        
        console.log('🎁 Gift Card Details:');
        console.log('   📧 Email (metadata):', data.metadata?.email);
        console.log('   📧 Email (customer_details):', data.customer_details?.email);
        console.log('   📧 Email (final):', email);
        console.log('   💰 Amount (metadata):', data.metadata?.amount);
        console.log('   💰 Amount (amount_total):', data.amount_total);
        console.log('   💰 Amount (final):', amount);
        console.log('   📦 Quantity:', quantity);
        console.log('   🏷️  Payment Type:', paymentType);
        console.log('   🔑 Stripe Session ID:', stripeSessionId);
        console.log('   💳 Stripe Payment Intent ID:', stripePaymentIntentId);

        if (!email || !amount) {
          console.error("❌ GIFT CARD PAYMENT METADATA INCOMPLETE");
          console.error("Missing required data:", {
            email: !!email,
            email_from_metadata: !!data.metadata?.email,
            email_from_customer_details: !!data.customer_details?.email,
            amount: !!amount,
            amount_from_metadata: !!data.metadata?.amount,
            amount_from_total: !!data.amount_total,
            full_data: JSON.stringify(data, null, 2),
          });
        } else {
          try {
            await this.giftCardService.createGiftCard({
              email,
              amount,
              quantity: quantity,
              stripe_session_id: stripeSessionId,
              stripe_payment_intent_id: stripePaymentIntentId,
            });
            console.log(`✓ Gift card created with quantity ${quantity} and email sent successfully`);
          } catch (error) {
            console.error("❌ Error creating gift card:", error);
            console.error("❌ Gift card creation error details:", {
              email,
              amount,
              errorMessage: error.message,
              errorStack: error.stack,
            });
            // Don't throw - allow payment to complete even if gift card creation fails
          }
        }
        
        // If gift card is the only payment type, return early
        if (!hasApplicationCreation && !hasInsurance) {
          return;
        }
      }

      // Handle insurance payments
      if (hasInsurance) {
        const applicationId = data.metadata.applicationId;
        const paymentAmount = Number(
          data.metadata.amountGBP ?? data.metadata.amount
        );
        const paymentType = data.metadata.paymentType;
        const orderId = data.metadata.orderId;
        const email = data.metadata.email;

        const applicationIdValid = !!applicationId;
        const paymentAmountValid = Number.isFinite(paymentAmount) && paymentAmount > 0;
        const paymentTypeValid = !!paymentType;
        const orderIdValid = !!orderId;
        const emailValid = !!email;

        // If travelerIndex is provided, validate and handle single-traveler insurance
        if (data.metadata.travelerIndex !== undefined && data.metadata.travelerIndex !== null && data.metadata.travelerIndex !== "") {
          const travelerIndex = parseInt(data.metadata.travelerIndex);
          const travelerIndexValid = !isNaN(travelerIndex) && travelerIndex >= 0;

          if (
            !travelerIndexValid ||
            !applicationIdValid ||
            !paymentAmountValid ||
            !paymentTypeValid ||
            !orderIdValid ||
            !emailValid
          ) {
            console.error("❌ INSURANCE PAYMENT METADATA INCOMPLETE");
            console.error("Missing/invalid required metadata:", {
              travelerIndex: travelerIndexValid ? travelerIndex : data.metadata.travelerIndex,
              travelerIndexValid,
              applicationId: applicationIdValid,
              paymentAmount: paymentAmountValid ? paymentAmount : data.metadata.amount,
              paymentAmountValid,
              paymentType: paymentTypeValid,
              orderId: orderIdValid,
              email: emailValid,
            });
            console.error("NOT processing insurance payment - missing or invalid required data");

            return;
          }

          const application = await VisaApplication.findByPk(applicationId);
          if (!application) {
            console.error("Application not found for insurance payment validation");
            callHTTPException("Application not found");
          }

          let travelersData = [];
          if (application.travelersData) {
            travelersData = JSON.parse(application.travelersData);
          }

          const currentTraveler = travelersData[travelerIndex];
          if (!currentTraveler) {
            console.error(`Traveler ${travelerIndex} not found in application`);
            callHTTPException("Traveler not found");
          }

          const expectedInsuranceCost = this.calculateInsuranceCost(currentTraveler, application);
          const expectedTotalWithFee = expectedInsuranceCost;

          const paymentValid = Math.abs(paymentAmount - expectedTotalWithFee) <= 1;

          if (!paymentValid) {
            console.error(`❌ INSURANCE PAYMENT AMOUNT MISMATCH: Expected £${expectedTotalWithFee}, received £${paymentAmount}`);
            console.error("This appears to be a travel-only payment, not insurance payment");
            console.error("NOT marking insurance as paid to prevent incorrect status");

            return;
          }

          await this.visaApplicationService.createOrUpdateApplication({
            type: VisaApplicationStepType.INSURANCE,
            applicationId: applicationId,
            currentTravelerIndex: travelerIndex,
            email: email,
            amountPaid: paymentAmount.toString(),
            paymentType: paymentType,
            orderId: orderId,
            insurancePaymentCompleted: true,
            paymentDate: new Date().toISOString(),
          });
        } else {
          // No travelerIndex provided => application-level insurance payment (covers all travelers)
          if (!applicationIdValid || !paymentAmountValid || !paymentTypeValid || !orderIdValid || !emailValid) {
            console.error("❌ APPLICATION-LEVEL INSURANCE PAYMENT METADATA INCOMPLETE");
            return;
          }

          const application = await VisaApplication.findByPk(applicationId);
          if (!application) {
            console.error("Application not found for application-level insurance payment");
            callHTTPException("Application not found");
          }

          let travelersData = [];
          if (application.travelersData) {
            travelersData = JSON.parse(application.travelersData);
          }

          // Sum expected insurance cost across all travelers
          let expectedTotal = 0;
          for (const trav of travelersData) {
            expectedTotal += this.calculateInsuranceCost(trav, application);
          }

          const paymentValid = Math.abs(paymentAmount - expectedTotal) <= 1;
          if (!paymentValid) {
            console.error(`❌ APPLICATION-LEVEL INSURANCE PAYMENT AMOUNT MISMATCH: Expected £${expectedTotal}, received £${paymentAmount}`);
            return;
          }

          // Mark application-level insurance payment as completed
          await this.visaApplicationService.createOrUpdateApplication({
            type: VisaApplicationStepType.INSURANCE,
            applicationId: applicationId,
            email: email,
            amountPaid: paymentAmount.toString(),
            paymentType: paymentType,
            orderId: orderId,
            insurancePaymentCompleted: true,
            paymentDate: new Date().toISOString(),
          });
        }
      } else if (hasApplicationCreation) {
        // Handle application creation (can be combined with gift card)
        const email = data.metadata?.email || data.customer_details?.email;
        const visaTypeId = data.metadata?.visaTypeId;
        const amountPaid = data.metadata?.amount;

        // Canonical idempotency key: always use data.id
        // - checkout.session.completed  → data.id = "cs_xxx"  (frontend also stores "cs_xxx" from URL)
        // - payment_intent.succeeded    → data.id = "pi_xxx"  (frontend also stores "pi_xxx" from sessionStorage)
        // Using data.payment_intent would pick "pi_xxx" for checkout sessions, mismatching the frontend's "cs_xxx"
        const stripePaymentId = data.id || null;

        console.log("🔍 Webhook: checking for duplicate via stripePaymentId column:", stripePaymentId);

        // Fast, reliable duplicate check: look up the dedicated column directly.
        // Catches BOTH webhook re-deliveries AND apps already created by the frontend.
        if (stripePaymentId) {
          const existingApplication = await VisaApplication.findOne({
            where: { stripePaymentId },
          });
          if (existingApplication) {
            console.log("✅ Duplicate prevented — stripePaymentId already in DB:", stripePaymentId, "applicationId:", existingApplication.id);
            return;
          }
        }
        return;

        console.log("✅ No duplicate found, webhook creating application for stripePaymentId:", stripePaymentId);

        await this.visaApplicationService.createOrUpdateApplication({
          type: VisaApplicationStepType.CREATE_APPLICATION,
          email: email,
          insurance: data.metadata.insurance,
          numberOfTravellers: data.metadata.travellers,
          amountPaid: amountPaid,
          country: data.metadata.country || null,
          visaTypeId: visaTypeId,
          stripePaymentId: stripePaymentId || undefined,
        });
      }
    } catch (err) {
      callHTTPException(err.message);
    }
  }

  private calculateInsuranceCost(
    travelerData: any,
    _application: VisaApplication
  ): number {
    const travelStartDate = travelerData?.basicDetails?.travelStartDate;
    const travelEndDate = travelerData?.basicDetails?.travelEndDate;

    if (travelStartDate && travelEndDate) {
      try {
        const start = new Date(travelStartDate);
        const end = new Date(travelEndDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const travelDays = Math.max(1, diffDays);
        const insuranceCost = travelDays * 2;

        return insuranceCost;
      } catch (error) {
        console.error("Error calculating travel days:", error);
      }
    }

    const defaultCost = 30 * 2;
    return defaultCost;
  }
}
