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
import { VisaApplication } from "src/applicationSteps/visa-application.entity";

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
    try {
      const rawReq = req as Request & { rawBody: Buffer };
      const response = await this.stripeService.handleWebhook(rawReq);
      return res.status(HttpStatus.OK).json(response);
    } catch (error) {
      console.error("Webhook processing error:", error);
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
