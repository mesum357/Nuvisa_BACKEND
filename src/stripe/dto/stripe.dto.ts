import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsArray,
} from "class-validator";
import { Transform } from "class-transformer";
import "reflect-metadata";

/** Accept JSON array or comma-separated string from clients. */
function toOptionalStringArray({ value }: { value: unknown }): string[] | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter((s) => s.length > 0);
  if (typeof value === "string") {
    const parts = value.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    return parts.length ? parts : undefined;
  }
  return undefined;
}

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

  /** e.g. "klarna" when user chose Klarna on the frontend */
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @Transform(toOptionalStringArray)
  @IsArray()
  @IsString({ each: true })
  payment_method_types?: string[];

  @IsOptional()
  @Transform(toOptionalStringArray)
  @IsArray()
  @IsString({ each: true })
  stripePaymentMethodTypes?: string[];
}
