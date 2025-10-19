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
  SendNotificationDto
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
  ) {
    try {
      const data = await this.adminService.getBackendUsers({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search,
        sortBy,
        sortOrder,
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
      const mockExportData = {
        format: exportDto.format || 'csv',
        filename: `applications_export_${new Date().toISOString().split('T')[0]}.${exportDto.format || 'csv'}`,
        downloadUrl: '#',
        recordCount: 100
      };

      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        mockExportData,
        'Export prepared successfully'
      );
    } catch (error) {
      console.error('Error in exportApplications:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * POST /orders/application/:id/notify
   * Send notification to traveler
   */
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
}