import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  UsePipes,
  ValidationPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import {
  SearchApplicationsDto,
  UpdateApplicationStatusDto,
  GetApplicationDetailsDto,
  DocumentStatusUpdateDto,
  ExportApplicationsDto,
  ExportUsersDto,
  SendNotificationDto,
  ApplicationStatus
} from './dto';
import { GetObjectTemplateForAPIResponseGeneral } from '../shared/data_templates/ObjectTemplateForAPIResponse';
import { EnumAPIResponseStatusType } from '../shared/enums';
import { callHTTPException } from '../shared/exceptions';
import { AuthGuard } from '../shared/middlewares/authGuad.middleware';

@Controller('orders')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * GET /orders/application-overview
   * Get overview of all applications
   */
  @Get('application-overview')
  async getApplicationOverview(@Req() request: any) {
    try {
      const data = await this.adminService.getApplicationOverview();
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Application overview fetched successfully'
      );
    } catch (error) {
      console.error('Error in getApplicationOverview:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * GET /orders/applicants
   * Return distinct users that have at least one application
   */
  @Get('applicants')
  async getApplicants(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('search') search: string,
    @Query('sortBy') sortBy: string,
    @Query('sortOrder') sortOrder: 'ASC' | 'DESC',
  ) {
    try {
      const data = await this.adminService.getApplicantsWithApplications({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search,
        sortBy,
        sortOrder,
      });
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Applicants fetched successfully'
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }

  /**
   * GET /orders/users
   * Return users from backend users table
   */
  @Get('users')
  async getBackendUsers(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('search') search: string,
    @Query('sortBy') sortBy: string,
    @Query('sortOrder') sortOrder: 'ASC' | 'DESC',
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    try {
      const data = await this.adminService.getBackendUsers({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search,
        sortBy,
        sortOrder,
        dateFrom,
        dateTo,
      });
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Users fetched successfully'
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }

  @Get('users/debug')
  async getBackendUsersDebug() {
    try {
      const data = await this.adminService.getBackendUsersDebug();
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Users debug'
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }

  /**
   * PATCH /orders/users/:id
   */
  @Patch('users/:id')
  async updateBackendUser(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    try {
      const data = await this.adminService.updateBackendUserById(id, body);
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'User updated successfully'
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }

  /**
   * GET /orders/documents-overview
   * Get overview of all documents
   */
  @Get('documents-overview')
  async getDocumentsOverview(@Req() request: any) {
    try {
      const data = await this.adminService.getDocumentsOverview();
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Documents overview fetched successfully'
      );
    } catch (error) {
      console.error('Error in getDocumentsOverview:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * GET /orders/search
   * Search applications with filters
   */
  @Get('search')
  @UsePipes(ValidationPipe)
  async searchApplications(@Query() searchDto: SearchApplicationsDto, @Req() request: any) {
    try {
      const data = await this.adminService.searchApplications(searchDto);
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Applications search completed successfully'
      );
    } catch (error) {
      console.error('Error in searchApplications:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * GET /orders/application/:id
   * Get detailed application information
   */
  @Get('application/:id')
  async getApplicationDetails(@Param('id') applicationId: string, @Req() request: any) {
    try {
      const data = await this.adminService.getApplicationDetails({ applicationId });
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Application details fetched successfully'
      );
    } catch (error) {
      console.error('Error in getApplicationDetails:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * PATCH /orders/application/:id/status
   * Update application status
   */
  @Patch('application/:id/status')
  @UsePipes(ValidationPipe)
  async updateApplicationStatus(
    @Param('id') applicationId: string,
    @Body() updateDto: Omit<UpdateApplicationStatusDto, 'applicationId'>,
    @Req() request: any
  ) {
    try {
      const data = await this.adminService.updateApplicationStatus({
        ...updateDto,
        applicationId,
        adminId: request.user?.id
      });
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Application status updated successfully'
      );
    } catch (error) {
      console.error('Error in updateApplicationStatus:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        applicationId,
        updateDto
      });
      callHTTPException(error.message);
    }
  }

  /**
   * GET /orders/stats
   * Get application statistics
   */
  @Get('stats')
  async getApplicationStats(@Query() filters: any, @Req() request: any) {
    try {
      const data = await this.adminService.getApplicationStats(filters);
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Application statistics fetched successfully'
      );
    } catch (error) {
      console.error('Error in getApplicationStats:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * GET /orders/application/:id/activity
   * Get application activity log
   */
  @Get('application/:id/activity')
  async getApplicationActivity(@Param('id') applicationId: string, @Req() request: any) {
    try {
      const data = await this.adminService.getApplicationActivity(applicationId);
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Application activity fetched successfully'
      );
    } catch (error) {
      console.error('Error in getApplicationActivity:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * GET /orders/application/:id/traveler/:travelerId/documents
   * Get traveler documents (mock implementation)
   */
  @Get('application/:id/traveler/:travelerId/documents')
  async getTravelerDocuments(
    @Param('id') applicationId: string,
    @Param('travelerId') travelerId: string,
    @Req() request: any
  ) {
    try {
      const data = await this.adminService.getTravelerDocumentsReal(applicationId, travelerId);
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Traveler documents fetched successfully'
      );
    } catch (error) {
      console.error('Error in getTravelerDocuments:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * PATCH /orders/document/:id/status
   * Update document status (mock implementation)
   */
  @Patch('document/:id/status')
  @UsePipes(ValidationPipe)
  async updateDocumentStatus(
    @Param('id') documentId: string,
    @Body() updateDto: Omit<DocumentStatusUpdateDto, 'documentId'>,
    @Req() request: any
  ) {
    try {
      const mockResponse = {
        documentId,
        status: updateDto.status,
        notes: updateDto.notes,
        updatedBy: request.user?.id,
        updatedAt: new Date()
      };

      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        mockResponse,
        'Document status updated successfully'
      );
    } catch (error) {
      console.error('Error in updateDocumentStatus:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * POST /orders/export
   * Export applications data
   */
  @Post('export')
  @UsePipes(ValidationPipe)
  async exportApplications(@Body() exportDto: ExportApplicationsDto, @Req() request: any) {
    try {
      const applications = await this.adminService.searchApplications({
        page: '1',
        limit: '10000', // Large limit for export
        status: exportDto.status as ApplicationStatus,
        query: exportDto.search,
        dateFrom: exportDto.startDate,
        dateTo: exportDto.endDate,
      });

      const exportData = applications.data.map((app: any) => ({
        'Application ID': app.id,
        'Order ID': app.orderId,
        'User Name': app.user?.name || '',
        'User Email': app.user?.email || '',
        'Phone': app.user?.phone || '',
        'Status': app.applicationStatus || app.status,
        'Total Amount': app.amountPaidTotal || app.totalAmount || 0,
        'Paid Amount': app.amountPaid || app.paidAmount || 0,
        'Created At': app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '',
        'Updated At': app.updatedAt ? new Date(app.updatedAt).toLocaleDateString() : '',
      }));

      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        {
          format: exportDto.format || 'csv',
          filename: `applications_export_${new Date().toISOString().split('T')[0]}.${exportDto.format || 'csv'}`,
          data: exportData,
          recordCount: exportData.length
        },
        'Export data retrieved successfully'
      );
    } catch (error) {
      console.error('Error in exportApplications:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * POST /orders/export/users
   * Export users data
   */
  @Post('export/users')
  @UsePipes(ValidationPipe)
  async exportUsers(@Body() exportDto: ExportUsersDto, @Req() request: any) {
    try {
      const users = await this.adminService.getBackendUsers({
        page: 1,
        limit: 10000, // Large limit for export
        search: exportDto.search,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
        dateFrom: exportDto.startDate,
        dateTo: exportDto.endDate,
      });

      const exportData = users.data.map((user: any) => ({
        'User ID': user.id,
        'Name': user.name || '',
        'Email': user.email || '',
        'Phone': user.phone || '',
        'Status': user.status || '',
        'Verified': user.isVerified ? 'Yes' : 'No',
        'Email Verified': user.emailVerified ? 'Yes' : 'No',
        'Applications Count': user.applicationsCount || 0,
        'Created At': user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '',
        'Updated At': user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : '',
      }));

      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        {
          format: exportDto.format || 'csv',
          filename: `users_export_${new Date().toISOString().split('T')[0]}.${exportDto.format || 'csv'}`,
          data: exportData,
          recordCount: exportData.length
        },
        'Export data retrieved successfully'
      );
    } catch (error) {
      console.error('Error in exportUsers:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * GET /orders/application/:id/comments
   * Get application comments
   */
  @Get('application/:id/comments')
  async getApplicationComments(@Param('id') applicationId: string, @Req() request: any) {
    try {
      const data = await this.adminService.getApplicationComments(applicationId);
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Application comments fetched successfully'
      );
    } catch (error) {
      console.error('Error in getApplicationComments:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * POST /orders/application/:id/comments
   * Add comment to application
   */
  @Post('application/:id/comments')
  async addApplicationComment(
    @Param('id') applicationId: string,
    @Body() body: { comment: string; isInternal: boolean; adminId?: string; adminEmail?: string },
    @Req() request: any
  ) {
    try {
      const data = await this.adminService.addApplicationComment({
        applicationId,
        comment: body.comment,
        isInternal: body.isInternal,
        adminId: body.adminId || request.user?.id,
        adminEmail: body.adminEmail || request.user?.email
      });
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Comment added successfully'
      );
    } catch (error) {
      console.error('Error in addApplicationComment:', error);
      callHTTPException(error.message);
    }
  }
  @Post('application/:id/notify')
  @UsePipes(ValidationPipe)
  async sendNotification(
    @Param('id') applicationId: string,
    @Body() notificationDto: Omit<SendNotificationDto, 'applicationId'>,
    @Req() request: any
  ) {
    try {
      const mockResponse = {
        applicationId,
        type: notificationDto.type,
        message: notificationDto.message,
        subject: notificationDto.subject,
        sentAt: new Date(),
        sentBy: request.user?.id,
        status: 'sent'
      };

      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        mockResponse,
        'Notification sent successfully'
      );
    } catch (error) {
      console.error('Error in sendNotification:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * Email Template Management Endpoints
   */

  /**
   * GET /orders/email-templates
   * Get all email templates
   */
  @Get('email-templates')
  async getEmailTemplates() {
    try {
      const data = await this.adminService.getEmailTemplates();
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Email templates fetched successfully'
      );
    } catch (error) {
      console.error('Error in getEmailTemplates:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * GET /orders/email-templates/:key
   * Get a specific email template by key
   */
  @Get('email-templates/:key')
  async getEmailTemplateByKey(@Param('key') key: string) {
    try {
      const data = await this.adminService.getEmailTemplateByKey(key);
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Email template fetched successfully'
      );
    } catch (error) {
      console.error('Error in getEmailTemplateByKey:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * POST /orders/email-templates
   * Create a new email template
   */
  @Post('email-templates')
  async createEmailTemplate(@Body() body: any, @Req() request: any) {
    try {
      const data = await this.adminService.createEmailTemplate({
        ...body,
        updatedBy: request.user?.email,
      });
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Email template created successfully'
      );
    } catch (error) {
      console.error('Error in createEmailTemplate:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * PATCH /orders/email-templates/:id
   * Update an existing email template
   */
  @Patch('email-templates/:id')
  async updateEmailTemplate(
    @Param('id') id: string,
    @Body() body: any,
    @Req() request: any
  ) {
    try {
      const data = await this.adminService.updateEmailTemplate(id, {
        ...body,
        updatedBy: request.user?.email,
      });
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Email template updated successfully'
      );
    } catch (error) {
      console.error('Error in updateEmailTemplate:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * DELETE /orders/email-templates/:id
   * Delete an email template
   */
  @Post('email-templates/:id/delete')
  async deleteEmailTemplate(@Param('id') id: string) {
    try {
      const data = await this.adminService.deleteEmailTemplate(id);
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Email template deleted successfully'
      );
    } catch (error) {
      console.error('Error in deleteEmailTemplate:', error);
      callHTTPException(error.message);
    }
  }
}