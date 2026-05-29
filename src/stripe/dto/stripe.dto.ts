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

  /** Browser origin where checkout started (e.g. http://localhost:3002). Used for Klarna return_url. */
  @IsOptional()
  @IsString()
  checkoutOrigin?: string;

  /** ISO2 billing country for Klarna (GB, DE, …). Separate from visa destination `country`. */
  @IsOptional()
  @IsString()
  billingCountry?: string;

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

  @IsOptional()
  @IsString()
  billingName?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  billingPhone?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  billingAddressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  line1?: string;

  @IsOptional()
  @IsString()
  billingAddressLine2?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsOptional()
  @IsString()
  billingCity?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  billingState?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  billingPostalCode?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  postcode?: string;

  @IsOptional()
  @IsString()
  zip?: string;

  /** "true" when checkout included the WhatsApp accountability expert add-on */
  @IsOptional()
  @IsString()
  expertCoachSelected?: string;
}
