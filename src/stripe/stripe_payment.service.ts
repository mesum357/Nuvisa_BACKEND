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

@Injectable()
export class StripeService {
  constructor(
    private readonly authService: AuthService,
    private readonly visaService: VisaService,
    private readonly visaApplicationService: VisaApplicationService
  ) {}

  async createCheckoutSession(checkoutData: checkoutSessionDto): Promise<any> {
    try {
      const stripe = Stripe(Env.stripeSecretKey);

      let { email, amount, successUrl, cancelUrl, paymentType } = checkoutData;

      const currency = (checkoutData.currency || "INR")
        .toString()
        .toLowerCase();

      const amountInCents = Math.round(Number(amount) * 100);

      const customerEmail = email ? { customer_email: email } : {};

      let authResponse = {};

      if (paymentType === "application_creation" || !paymentType) {
        const loginDto = {
          email: email,
          sessionUser: true,
        };

        authResponse = await this.authService.login(loginDto);
      } else {
        authResponse = {
          message: "Using existing session for insurance payment",
          token: "existing_session_reused",
        };
      }

      const session = await stripe.checkout.sessions.create({
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
        success_url: `${Env.WEBSITE_URL}${successUrl}`,
        cancel_url: `${Env.WEBSITE_URL}${cancelUrl}`,
        metadata: {
          ...checkoutData,
        },
      });

      return { url: session.url, ...authResponse };
    } catch (err) {
      callHTTPException(
        `Something went wrong while generating sessionId: ${err.message}`
      );
    }
  }

  async handleWebhook(req: Request & { rawBody: Buffer }) {
    try {
      const stripe = new Stripe(Env.stripeSecretKey, {
        apiVersion: "2020-08-27",
      });
      const signature = req.headers["stripe-signature"];

      let event;
      try {
        event = stripe.webhooks.constructEvent(
          req.rawBody,
          signature,
          Env.Webhook_Secret
        );
      } catch (err) {
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
      if (
        data.metadata.paymentType === "additional_traveler_insurance" ||
        data.metadata.paymentType === "traveler_insurance"
      ) {
        const travelerIndex = parseInt(data.metadata.travelerIndex);
        const applicationId = data.metadata.applicationId;
        const paymentAmount = Number(
          data.metadata.amountGBP ?? data.metadata.amount
        );
        const paymentType = data.metadata.paymentType;
        const orderId = data.metadata.orderId;
        const email = data.metadata.email;

        const travelerIndexValid = !isNaN(travelerIndex) && travelerIndex >= 0;
        const applicationIdValid = !!applicationId;
        const paymentAmountValid =
          Number.isFinite(paymentAmount) && paymentAmount > 0;
        const paymentTypeValid = !!paymentType;
        const orderIdValid = !!orderId;
        const emailValid = !!email;

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
            travelerIndex: travelerIndexValid
              ? travelerIndex
              : data.metadata.travelerIndex,
            travelerIndexValid,
            applicationId: applicationIdValid,
            paymentAmount: paymentAmountValid
              ? paymentAmount
              : data.metadata.amount,
            paymentAmountValid,
            paymentType: paymentTypeValid,
            orderId: orderIdValid,
            email: emailValid,
          });
          console.error(
            "NOT processing insurance payment - missing or invalid required data"
          );

          return;
        }

        const application = await VisaApplication.findByPk(
          data.metadata.applicationId
        );

        if (!application) {
          console.error(
            "Application not found for insurance payment validation"
          );
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

        const expectedInsuranceCost = this.calculateInsuranceCost(
          currentTraveler,
          application
        );
        const expectedTotalWithFee = expectedInsuranceCost;

        const paymentValid =
          Math.abs(paymentAmount - expectedTotalWithFee) <= 1;

        if (!paymentValid) {
          console.error(
            `❌ INSURANCE PAYMENT AMOUNT MISMATCH: Expected £${expectedTotalWithFee}, received £${paymentAmount}`
          );
          console.error(
            "This appears to be a travel-only payment, not insurance payment"
          );
          console.error(
            "NOT marking insurance as paid to prevent incorrect status"
          );

          return;
        }

          await this.visaApplicationService.createOrUpdateApplication({
            type: VisaApplicationStepType.INSURANCE,
            applicationId: data.metadata.applicationId,
            currentTravelerIndex: travelerIndex,
            email: data.metadata.email,
            amountPaid: paymentAmount.toString(),
            paymentType: data.metadata.paymentType,
            orderId: data.metadata.orderId,
            insurancePaymentCompleted: true,
            paymentDate: new Date().toISOString(),
          });
      } else {
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
    } catch (err) {
      callHTTPException(err.message);
    }
  }

  private calculateInsuranceCost(
    travelerData: any,
    application: VisaApplication
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
