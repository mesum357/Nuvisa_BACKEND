import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import "reflect-metadata";

export class RedeemGiftCardDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  packagePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  travelerCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  appliedGiftCardCount?: number;
}

export class ValidateGiftCardDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  packagePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  travelerCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  appliedGiftCardCount?: number;
}

export class FulfillGiftCardDto {
  @IsNotEmpty()
  @IsString()
  email: string;

  @IsNotEmpty()
  @IsString()
  amount: string;

  @IsOptional()
  quantity?: number;

  @IsOptional()
  @IsString()
  stripe_session_id?: string;

  @IsOptional()
  @IsString()
  stripe_payment_intent_id?: string;
}

