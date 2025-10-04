import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNumber,
  IsJSON,
} from "class-validator";
import { Type } from "class-transformer";

export enum VisaApplicationStepType {
  CREATE_APPLICATION = "createApplication",
  BASIC_DETAILS = "basicDetails",
  VISIT_DETAILS = "visitDetails",
  DOCUMENTS = "documents",
  APPOINTMENT = "appointment",
  FULL_PAYMENT = "fullPayment",
  INSURANCE = "insurance",
  PAYMENT = "payment",
}

// Basic Details DTO for each traveler
export class TravelerBasicDetailsDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  passportNumber?: string;

  @IsOptional()
  @IsString()
  sex?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  placeOfBirth?: string;

  @IsOptional()
  @IsString()
  passportIssuePlace?: string;

  @IsOptional()
  @IsString()
  passportIssueDate?: string;

  @IsOptional()
  @IsString()
  passportExpiryDate?: string;

  @IsOptional()
  @IsString()
  currentAddress1?: string;

  @IsOptional()
  @IsString()
  currentAddress2?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @IsOptional()
  passportFront?: any;

  @IsOptional()
  passportBack?: any;

  @IsOptional()
  @IsString()
  travelStartDate?: string;

  @IsOptional()
  @IsString()
  travelEndDate?: string;
}

export class TravelerVisitDetailsDto {
  @IsOptional()
  @IsArray()
  visitingOtherSchengenCountries?: string[];

  @IsOptional()
  @IsString()
  firstCountryOfEntry?: string;

  @IsOptional()
  @IsString()
  hasSchengenVisa?: string;

  @IsOptional()
  @IsString()
  lastVisaStartDate?: string;

  @IsOptional()
  @IsString()
  lastVisaEndDate?: string;

  @IsOptional()
  @IsString()
  hasDigitalFingerprints?: string;

  @IsOptional()
  @IsString()
  previousVisaNumber?: string;

  @IsOptional()
  @IsString()
  maritalStatus?: string;

  @IsOptional()
  @IsString()
  partnerFullName?: string;

  @IsOptional()
  @IsString()
  partnerDateOfBirth?: string;

  @IsOptional()
  @IsString()
  employmentStatus?: string;

  @IsOptional()
  @IsString()
  institutionName?: string;

  @IsOptional()
  @IsString()
  instituteEmail?: string;

  @IsOptional()
  @IsString()
  instituteAddress?: string;

  @IsOptional()
  @IsString()
  employerPhone?: string;

  @IsOptional()
  @IsString()
  employerName?: string;

  @IsOptional()
  @IsString()
  employerEmail?: string;

  @IsOptional()
  @IsString()
  employerAddress?: string;

  @IsOptional()
  @IsString()
  otherEmploymentStatus?: string;

  @IsOptional()
  @IsString()
  willAnyonePayForVisit?: string;

  @IsOptional()
  @IsString()
  fundingPersonName?: string;

  @IsOptional()
  @IsString()
  tripFundedBy?: string;
}

export class TravelerDocumentsDto {
  @IsOptional()
  documents?: any;
}

export class TravelerInsuranceDto {
  @IsOptional()
  @IsBoolean()
  insurance?: boolean;

  @IsOptional()
  insuranceDetails?: any;

  @IsOptional()
  insuranceCertificate?: any;

  @IsOptional()
  insuranceCertificates?: any;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsNumber()
  paymentAmount?: number;

  @IsOptional()
  @IsString()
  paymentDate?: string; // ISO date string when payment was made

  @IsOptional()
  @IsBoolean()
  insurancePaymentCompleted?: boolean;

  @IsOptional()
  @IsBoolean()
  paidInCheckout?: boolean; // Flag to indicate if insurance was paid during checkout

  @IsOptional()
  @IsString()
  insuranceSource?: string; // 'checkout' | 'individual' | 'uploaded'
}

export class InsuranceDetailDto {
  @IsOptional()
  @IsNumber()
  certificateCount?: number;

  @IsOptional()
  @IsArray()
  certificate?: any[];

  @IsOptional()
  @IsJSON()
  paidInCheckout?: any;

  @IsOptional()
  @IsJSON()
  paidInApplication?: any;
}
export class TravelerFullPaymentDto {
  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsNumber()
  paymentAmount?: number;

  @IsOptional()
  @IsString()
  paymentDate?: string; // ISO date string when payment was made

  @IsOptional()
  @IsBoolean()
  paymentCompleted?: boolean;

  @IsOptional()
  @IsBoolean()
  includeInsurance?: boolean;

  @IsOptional()
  @IsString()
  insuranceType?: string; // 'own' | 'purchase' | 'none'

  @IsOptional()
  insuranceCertificate?: any;

  @IsOptional()
  insuranceDetails?: any;

  @IsOptional()
  @IsBoolean()
  paidInCheckout?: boolean; // Flag to indicate if full payment was made during checkout
}

export class TravelerPaymentDto {
  @IsOptional()
  @IsNumber()
  appointmentFees?: number;

  @IsOptional()
  @IsNumber()
  teleportFee?: number;

  @IsOptional()
  @IsNumber()
  cgst?: number;

  @IsOptional()
  @IsNumber()
  sgst?: number;

  @IsOptional()
  @IsNumber()
  grandTotal?: number;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;
}

export class TravelerAppointmentDto {
  @IsOptional()
  preference1?: any;

  @IsOptional()
  preference2?: any;
}

export class TravelerDataDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TravelerBasicDetailsDto)
  basicDetails?: TravelerBasicDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TravelerVisitDetailsDto)
  visitDetails?: TravelerVisitDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TravelerDocumentsDto)
  documents?: TravelerDocumentsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TravelerFullPaymentDto)
  fullPayment?: TravelerFullPaymentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TravelerInsuranceDto)
  insurance?: TravelerInsuranceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TravelerAppointmentDto)
  appointment?: TravelerAppointmentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TravelerPaymentDto)
  payment?: TravelerPaymentDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  completedSteps?: string[];

  @IsOptional()
  @IsString()
  currentStep?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class VisaApplicationDto {
  @IsNotEmpty()
  @IsEnum(VisaApplicationStepType)
  type: VisaApplicationStepType;

  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @IsOptional()
  @IsNumber()
  paymentWithoutInsurance?: number;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsBoolean()
  insurance?: boolean;

  @IsOptional()
  insuranceDetails?: InsuranceDetailDto;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  visaTypeId?: string;

  @IsOptional()
  selectedVisaType?: any;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  amountPaid?: string;

  @IsOptional()
  @IsNumber()
  initiallyPaidTraveler?: number;

  @IsOptional()
  @IsNumber()
  totalTraveler?: number;

  @IsOptional()
  @IsString()
  amountPaidTotal?: string;

  @IsOptional()
  @IsString()
  initialInsurancePaidTotal?: string;

  @IsOptional()
  @IsArray()
  insuranceCertificates?: any[];

  @IsOptional()
  @IsString()
  paymentType?: string;

  @IsOptional()
  insuranceCertificate?: any;

  @IsOptional()
  @IsBoolean()
  insurancePaymentCompleted?: boolean;

  @IsOptional()
  @IsString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  travelStartDate?: string;

  @IsOptional()
  @IsString()
  travelEndDate?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TravelerFullPaymentDto)
  fullPayment?: TravelerFullPaymentDto;

  @IsOptional()
  appointment?: any;

  @IsOptional()
  @IsNumber()
  numberOfTravellers?: number;

  @IsOptional()
  @IsNumber()
  currentTravelerIndex?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TravelerDataDto)
  travelersData?: TravelerDataDto[];

  @IsOptional()
  @IsString()
  currentStep?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  completedSteps?: string[];

  @IsOptional()
  @IsNumber()
  stepProgress?: number;

  @IsOptional()
  stepData?: any;
}

export class GetApplicationByIdDto {
  @IsOptional()
  @IsString()
  id?: string;
}

export class VisaApplicationDeleteDto {
  @IsOptional()
  @IsString()
  id: string;
}

export class VisaApplicationUpdateDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsJSON()
  insurance?: TravelerInsuranceDto;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  visaTypeId?: string;

  @IsOptional()
  selectedVisaType?: any;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  amountPaid?: string;

  @IsOptional()
  @IsNumber()
  initiallyPaidTraveler?: number;

  @IsOptional()
  @IsNumber()
  totalTraveler?: number;

  @IsOptional()
  @IsString()
  amountPaidTotal?: string;

  @IsOptional()
  @IsString()
  initialInsurancePaidTotal?: string;

  @IsOptional()
  @IsArray()
  insuranceCertificates?: any[];

  @IsOptional()
  @IsString()
  paymentType?: string;

  @IsOptional()
  insuranceDetails?: any;

  @IsOptional()
  insuranceCertificate?: any;

  @IsOptional()
  @IsBoolean()
  insurancePaymentCompleted?: boolean;

  @IsOptional()
  @IsString()
  paymentDate?: string;

  @IsOptional()
  stepData?: any;
  @IsOptional()
  @IsString()
  currentStep?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  completedSteps?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TravelerDataDto)
  travelersData?: TravelerDataDto[];

  @IsOptional()
  @IsNumber()
  numberOfTravellers?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => TravelerFullPaymentDto)
  fullPayment?: TravelerFullPaymentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TravelerAppointmentDto)
  appointment: TravelerAppointmentDto;

  @IsOptional()
  @IsString()
  travelStartDate?: string;

  @IsOptional()
  @IsString()
  travelEndDate?: string;
}
