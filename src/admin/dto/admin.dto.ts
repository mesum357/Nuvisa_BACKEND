import { IsOptional, IsString, IsDateString, IsEnum, IsIn, IsArray, ArrayNotEmpty, ArrayUnique, IsBoolean } from 'class-validator';

export enum ApplicationStatus {
  NEW = 'new',
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled'
}

export enum SearchType {
  ALL = 'all',
  APPLICATION_ID = 'applicationId',
  ORDER_ID = 'orderId'
}

export class SearchApplicationsDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsEnum(SearchType)
  type?: SearchType;

  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

export class UpdateApplicationStatusDto {
  @IsString()
  applicationId: string;

  /** Backend stores workflow status (e.g. decision_made); not limited to ApplicationStatus enum. */
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  adminId?: string;

  @IsOptional()
  @IsBoolean()
  sendNotification?: boolean;

  /** Admin UI key: DECISION_MADE | PASSPORT_DISPATCHED | PASSPORT_READY */
  @IsOptional()
  @IsString()
  adminStatusKey?: string;

  @IsOptional()
  @IsString()
  statusDisplay?: string;

  @IsOptional()
  @IsString()
  statusMessage?: string;

  @IsOptional()
  @IsString()
  newStatus?: string;

  @IsOptional()
  @IsString()
  oldStatus?: string;
}

export class GetApplicationDetailsDto {
  @IsString()
  applicationId: string;
}

export class DocumentStatusUpdateDto {
  @IsString()
  documentId: string;

  @IsIn(['approved', 'rejected', 'pending'])
  status: 'approved' | 'rejected' | 'pending';

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  adminId?: string;
}

export class ExportApplicationsDto {
  @IsOptional()
  @IsIn(['csv', 'xlsx'])
  format?: 'csv' | 'xlsx';

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  applicationIds?: string[];

  @IsOptional()
  filters?: SearchApplicationsDto;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class ExportUsersDto {
  @IsOptional()
  @IsIn(['csv', 'xlsx'])
  format?: 'csv' | 'xlsx';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class SendNotificationDto {
  @IsString()
  applicationId: string;

  @IsEnum(['email', 'sms'])
  type: 'email' | 'sms';

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  subject?: string;
}