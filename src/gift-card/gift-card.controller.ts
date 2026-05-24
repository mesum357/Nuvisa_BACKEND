import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  Param,
  UsePipes,
  ValidationPipe,
  UseGuards,
  Req,
} from "@nestjs/common";
import { GiftCardService } from "./gift-card.service";
import {
  FulfillGiftCardDto,
  RedeemGiftCardDto,
  ValidateGiftCardDto,
} from "./dto/gift-card.dto";
import {
  GetObjectTemplateForAPIResponseGeneral,
  ObjectTemplateForAPIResponseGeneral,
} from "src/shared/data_templates/ObjectTemplateForAPIResponse";
import { EnumAPIResponseStatusType } from "src/shared/enums";
import { callHTTPException } from "src/shared/exceptions";
import { AuthGuard } from "src/shared/middlewares/authGuad.middleware";

@Controller("gift-card")
export class GiftCardController {
  constructor(private readonly giftCardService: GiftCardService) {}

  @Post("fulfill-purchase")
  @UsePipes(ValidationPipe)
  async fulfillGiftCardPurchase(@Body() dto: FulfillGiftCardDto): Promise<any> {
    try {
      const result = await this.giftCardService.fulfillGiftCardPurchase({
        email: dto.email,
        amount: dto.amount,
        quantity: dto.quantity,
        stripe_session_id: dto.stripe_session_id,
        stripe_payment_intent_id: dto.stripe_payment_intent_id,
      });

      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        result,
        result.created
          ? "Gift card created and confirmation email sent"
          : "Gift card confirmation email resent",
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }

  @Post("validate")
  @UsePipes(ValidationPipe)
  async validateGiftCard(@Body() dto: ValidateGiftCardDto): Promise<any> {
    try {
      const result = await this.giftCardService.validateGiftCard(dto);
      return GetObjectTemplateForAPIResponseGeneral(
        result.valid
          ? EnumAPIResponseStatusType.SUCCESS
          : EnumAPIResponseStatusType.ERROR,
        result,
        result.message
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }

  @Post("redeem")
  @UsePipes(ValidationPipe)
  async redeemGiftCard(
    @Body() dto: RedeemGiftCardDto,
    @Req() request?: any
  ): Promise<any> {
    try {
      // Extract user info from request if authenticated
      const userId = request?.user?.id || null;
      const userEmail = request?.user?.email || dto.email || null;

      const result = await this.giftCardService.redeemGiftCard(
        dto,
        userId,
        userEmail
      );

      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        result,
        result.message
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }

  @Get("validate/:code")
  async validateGiftCardByCode(@Param("code") code: string): Promise<any> {
    try {
      const dto: ValidateGiftCardDto = { code };
      const result = await this.giftCardService.validateGiftCard(dto);
      return GetObjectTemplateForAPIResponseGeneral(
        result.valid
          ? EnumAPIResponseStatusType.SUCCESS
          : EnumAPIResponseStatusType.ERROR,
        result,
        result.message
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }

  // TEST: List recent gift cards by email (local testing only)
  @Get("test-list")
  async listGiftCards(@Query('email') email?: string): Promise<any> {
    try {
      const where: any = {};
      if (email) where.email = email;
      const items = await (this as any).giftCardService['giftCardModel'].findAll({
        where,
        order: [['purchased_at', 'DESC']],
        limit: 50,
      });
      return {
        status: 'success',
        results: items.map((i: any) => ({ code: i.code, email: i.email, amount: i.amount, purchased_at: i.purchased_at, is_used: i.is_used })),
      };
    } catch (err) {
      callHTTPException(err.message);
    }
  }
}

