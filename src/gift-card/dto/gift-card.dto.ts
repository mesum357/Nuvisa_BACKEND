import {
  IsString,
  IsNotEmpty,
  IsOptional,
} from "class-validator";
import "reflect-metadata";

export class RedeemGiftCardDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  email?: string;
}

export class ValidateGiftCardDto {
  @IsNotEmpty()
  @IsString()
  code: string;
}

