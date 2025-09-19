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
} from "class-validator";
import { Type } from "class-transformer";

export enum VisaApplicationStepType {
  CREATE_APPLICATION = "createApplication",
  BASIC_DETAILS = "basicDetails",
  VISIT_DETAILS = "visitDetails",
  DOCUMENTS = "documents",
  APPOINTMENT = "appointment",
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

// Visit Details DTO for each traveler
export class TravelerVisitDetailsDto {
  // Travel Information (always present in current form)
  @IsOptional()
  @IsArray()
  visitingOtherSchengenCountries?: string[];

  @IsOptional()
  @IsString()
  firstCountryOfEntry?: string;

  // Visa History (always present in current form)
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

  // Personal Information (always present in current form)
  @IsOptional()
  @IsString()
  maritalStatus?: string;

  @IsOptional()
  @IsString()
  partnerFullName?: string;

  @IsOptional()
  @IsString()
  partnerDateOfBirth?: string;

  // Employment Information (always present in current form)
  @IsOptional()
  @IsString()
  employmentStatus?: string;

  // Student fields (conditional)
  @IsOptional()
  @IsString()
  institutionName?: string;

  @IsOptional()
  @IsString()
  instituteEmail?: string;

  @IsOptional()
  @IsString()
  instituteAddress?: string;

  // Employed fields (conditional)
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

  // Other employment (conditional)
  @IsOptional()
  @IsString()
  otherEmploymentStatus?: string;

  // Payment Information (always present in current form)
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

// Documents DTO for each traveler
export class TravelerDocumentsDto {
  @IsOptional()
  documents?: any; // can be file list or JSON metadata
}

// Insurance DTO for each traveler
export class TravelerInsuranceDto {
  @IsOptional()
  @IsString()
  insurance?: string;

  @IsOptional()
  insuranceDetails?: any;

  @IsOptional()
  insuranceCertificate?: any; // For uploaded insurance certificates
}

// Payment DTO for each traveler
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

// Appointment DTO for each traveler
export class TravelerAppointmentDto {
  @IsOptional()
  preference1?: any;

  @IsOptional()
  preference2?: any;
}

// Complete traveler data DTO
export class TravelerDataDto {
  @IsOptional()
  @IsNumber()
  id?: number;

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
  applicationId?: string; // for steps after basicDetails

  // Application level fields
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  insurance?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  visaTypeId?: string; // SMV Konveyor visa type ID

  @IsOptional()
  selectedVisaType?: any; // Complete selected visa type object from SMV API

  @IsOptional()
  @IsString()
  orderId?: string; // SMV Konveyor order ID from /orders endpoint

  @IsOptional()
  @IsString()
  amountPaid?: string;

  @IsOptional()
  @IsString()
  paymentType?: string; // To distinguish between different payment types

  @IsOptional()
  insuranceDetails?: any; // For insurance selection details (hasOwnInsurance, certificateUploaded, etc.)

  @IsOptional()
  insuranceCertificate?: any; // For uploaded insurance certificates

  @IsOptional()
  appointment?: any; // For appointment data (preference1, preference2, etc.)

  // Traveler management fields
  @IsOptional()
  @IsNumber()
  numberOfTravellers?: number;

  @IsOptional()
  @IsNumber()
  currentTravelerIndex?: number; // To track which traveler's step we're processing

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TravelerDataDto)
  travelersData?: TravelerDataDto[]; // Complete structured data for all travelers

  // Application step tracking fields
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
