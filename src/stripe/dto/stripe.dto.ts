import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
  IsNumber,
} from "class-validator";
import "reflect-metadata";

export class checkoutSessionDto {
  @IsNotEmpty()
  @IsString()
  email: string;

  @IsOptional()
  @IsString()
  successUrl?: string;

  @IsOptional()
  @IsString()
  cancelUrl?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  travellers?: string;

  @IsString()
  @IsNotEmpty()
  amount: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsString()
  insurance: string;

  // Optional fields for traveler insurance payments
  @IsOptional()
  @IsString()
  applicationId?: string;

  @IsOptional()
  @IsString()
  travelerIndex?: string;

  @IsOptional()
  @IsString()
  paymentType?: string;

  // Optional field for SMV Konveyor visa type ID
  @IsOptional()
  @IsString()
  visaTypeId?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  uiMode?: string; // 'hosted' or 'embedded'
}
