import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UsePipes,
  ValidationPipe,
  UseGuards,
  Req,
} from "@nestjs/common";
import { GiftCardService } from "./gift-card.service";
import { RedeemGiftCardDto, ValidateGiftCardDto } from "./dto/gift-card.dto";
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
}

