import {
  Controller,
  Post,
  Get,
  Req,
  Res,
  Body,
  Query,
  UsePipes,
  ValidationPipe,
  UseGuards,
  HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "../shared/middlewares/authGuad.middleware";
import {
  GetObjectTemplateForAPIResponseGeneral,
  ObjectTemplateForAPIResponseGeneral,
} from "src/shared/data_templates/ObjectTemplateForAPIResponse";
import { EnumAPIResponseStatusType } from "src/shared/enums";
import { callHTTPException } from "src/shared/exceptions";
import { StripeService } from "./stripe_payment.service";
import { checkoutSessionDto } from "./dto/stripe.dto";
import { Request, Response } from "express";
import { VisaApplication } from "src/applicationSteps/visa-application.entity";
import { AdminService } from "src/admin/admin.service";

@Controller("stripe_payment")
export class StripeController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly adminService: AdminService
  ) {}

  @Post("session")
  @UsePipes(ValidationPipe)
  async createCheckOutSession(
    @Req() request: string,
    @Body() checkoutSessionDto: checkoutSessionDto
  ): Promise<any> {
    try {
      const data =
        await this.stripeService.createCheckoutSession(checkoutSessionDto);
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        "Session Id Created Successfully"
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }

  @Get("session-metadata")
  async getSessionMetadata(@Query("payment_id") paymentId: string): Promise<any> {
    try {
      const result =
        await this.stripeService.getSessionOrPaymentIntentMetadata(paymentId);
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        {
          metadata: result?.metadata || {},
          paymentIntentStatus: result?.paymentIntentStatus || null,
          paymentIntentId: result?.paymentIntentId || null,
        },
        "Session metadata retrieved"
      );
    } catch (error) {
      callHTTPException(error?.message || "Failed to get session metadata");
    }
  }

  @Post("payment-intent")
  @UsePipes(ValidationPipe)
  async createPaymentIntent(
    @Body() checkoutSessionDto: checkoutSessionDto
  ): Promise<any> {
    try {
      const data =
        await this.stripeService.createPaymentIntent(checkoutSessionDto);
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        "Payment Intent Created Successfully"
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }

  @Post("webhook")
  async handleStripeWebhook(@Req() req: Request, @Res() res: Response) {
    try {
      console.log('\n🔔 WEBHOOK RECEIVED!');
      console.log('=' .repeat(60));
      console.log('📨 Incoming webhook request');
      console.log('   Timestamp:', new Date().toISOString());
      console.log('   Path:', req.path);
      console.log('   Method:', req.method);
      console.log('   Headers signature:', req.headers['stripe-signature'] ? '✅ Present' : '❌ Missing');
      
      const rawReq = req as Request & { rawBody: Buffer };
      
      // Double-check: if rawBody wasn't set by middleware, try to get it from req.body
      // (express.raw() should have set req.body to a Buffer)
      if (!rawReq.rawBody && (req as any).body) {
        if (Buffer.isBuffer((req as any).body)) {
          rawReq.rawBody = (req as any).body;
          console.log("✅ Raw body captured from req.body (Buffer)");
        } else {
          console.error("❌ req.body is not a Buffer - middleware may not be working correctly");
          console.error("   req.body type:", typeof (req as any).body);
          console.error("   Is Buffer:", Buffer.isBuffer((req as any).body));
        }
      }
      
      console.log('📊 Raw body info:');
      console.log('   Is Buffer:', Buffer.isBuffer(rawReq.rawBody));
      console.log('   Length:', rawReq.rawBody?.length || 0, 'bytes');
      
      const response = await this.stripeService.handleWebhook(rawReq);
      console.log('✅ Webhook processed successfully');
      console.log('=' .repeat(60) + '\n');
      return res.status(HttpStatus.OK).json(response);
    } catch (error) {
      console.error("❌ Webhook processing error:", error);
      console.error('=' .repeat(60) + '\n');
      callHTTPException(error.message);
    }
  }

  @Post("test-insurance-payment")
  @UsePipes(ValidationPipe)
  async testInsurancePayment(@Body() body: any): Promise<any> {
    try {
      const mockOrderId =
        body.orderId ||
        `ORD${String(Math.floor(Math.random() * 900000) + 100000)}`;

      let derivedAmount = body.amount;
      let derivedEmail = body.email;
      if ((!derivedAmount || derivedAmount === "") && body.applicationId) {
        try {
          const app = await VisaApplication.findByPk(body.applicationId);
          if (app) {
            derivedEmail = derivedEmail || app.email;
            if (app.travelersData) {
              try {
                const travelers = JSON.parse(app.travelersData || "[]");
                const idx = parseInt(body.travelerIndex);
                const traveler = travelers[idx];
                if (traveler && traveler.basicDetails) {
                  const start = traveler.basicDetails.travelStartDate
                    ? new Date(traveler.basicDetails.travelStartDate)
                    : null;
                  const end = traveler.basicDetails.travelEndDate
                    ? new Date(traveler.basicDetails.travelEndDate)
                    : null;
                  if (
                    start &&
                    end &&
                    !isNaN(start.getTime()) &&
                    !isNaN(end.getTime())
                  ) {
                    const diffTime = Math.abs(end.getTime() - start.getTime());
                    const diffDays = Math.ceil(
                      diffTime / (1000 * 60 * 60 * 24)
                    );
                    const travelDays = Math.max(1, diffDays);
                    const insuranceCost = travelDays * 2;
                    derivedAmount = String(insuranceCost.toFixed(2));
                  }
                }
              } catch (e) {}
            }
          }
        } catch (err) {}
      }

      const mockPaymentData = {
        metadata: {
          paymentType: body.paymentType || "traveler_insurance",
          travelerIndex: body.travelerIndex,
          applicationId: body.applicationId,
          email: derivedEmail || body.email,
          amount: derivedAmount || body.amount,
          amountGBP: derivedAmount || body.amount,
          orderId: mockOrderId,
        },
      };

      const result =
        await this.stripeService.handlePaymentSuccess(mockPaymentData);

      try {
        await this.adminService.sendInsurancePurchaseConfirmation({
          email: derivedEmail || body.email,
          amount: derivedAmount || body.amount,
          applicationId: body.applicationId,
          orderId: mockOrderId,
        });
      } catch (emailErr) {
        console.error("Insurance confirmation email failed:", emailErr);
      }

      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        result,
        "Insurance payment updated successfully"
      );
    } catch (error) {
      console.error("Test insurance payment error:", error);
      callHTTPException(error.message);
    }
  }

  // TEST: Trigger gift card handling directly (bypasses Stripe signature)
  @Post("test-giftcard")
  @UsePipes(ValidationPipe)
  async testGiftCardPayment(@Body() body: any): Promise<any> {
    try {
      const mockOrderId = body.orderId || `ORD${String(Math.floor(Math.random() * 900000) + 100000)}`;

      const mockPaymentData = {
        metadata: {
          paymentType: body.paymentType || "gift_card",
          email: body.email,
          amount: body.amount,
          quantity: body.quantity || body.noOfGiftCards || 1,
          orderId: mockOrderId,
        },
      };

      const result = await this.stripeService.handlePaymentSuccess(mockPaymentData as any);

      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        result,
        "Gift card test payment processed"
      );
    } catch (error) {
      console.error("Test gift card payment error:", error);
      callHTTPException(error.message);
    }
  }
}
