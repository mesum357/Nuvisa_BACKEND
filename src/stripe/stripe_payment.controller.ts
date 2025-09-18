import {
  Controller,
  Post,
  Req,
  Res,
  Body,
  Headers,
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

@Controller("stripe_payment")
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

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

  @Post("webhook")
  async handleStripeWebhook(@Req() req: Request, @Res() res: Response) {
    console.log("=== WEBHOOK ENDPOINT HIT ===");
    console.log("Webhook request received");
    try {
      const rawReq = req as Request & { rawBody: Buffer };
      console.log("Processing webhook...");
      const response = await this.stripeService.handleWebhook(rawReq);
      console.log("Webhook processed successfully");
      return res.status(HttpStatus.OK).json(response);
    } catch (error) {
      console.error("Webhook processing error:", error);
      callHTTPException(error.message);
    }
  }

  // Test endpoint to manually trigger insurance payment update (for development)
  @Post("test-insurance-payment")
  @UsePipes(ValidationPipe)
  async testInsurancePayment(@Body() body: any): Promise<any> {
    try {
      console.log("=== MANUAL INSURANCE PAYMENT TEST ===");
      console.log("Test payment data:", body);
      
      // Simulate the payment success data structure
      const mockPaymentData = {
        metadata: {
          paymentType: body.paymentType || "traveler_insurance",
          travelerIndex: body.travelerIndex,
          applicationId: body.applicationId,
          email: body.email,
          amount: body.amount
        }
      };
      
      const result = await this.stripeService.handlePaymentSuccess(mockPaymentData);
      
      console.log("=== END MANUAL INSURANCE PAYMENT TEST ===");
      
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
}
