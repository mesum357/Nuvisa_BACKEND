import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { VisaApplication } from '../applicationSteps/visa-application.entity';
import { User } from '../auth/auth.entity';
import { EmailTemplate } from '../email-templates/email-template.entity';
import { EmailLog } from '../email-logs/email-log.entity';
import { Op, QueryTypes, where, col, cast, fn, col as sqCol, literal } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import {
  SearchApplicationsDto,
  UpdateApplicationStatusDto,
  GetApplicationDetailsDto,
  ApplicationStatus,
  SearchType
} from './dto';
import { sendEmail, renderTemplate, renderTemplateFromDB, getEmailTemplateHeaderFooter } from '../shared/services/sendEmail.service';
import { Env } from '../shared/config';
import {
  getApplicationStatusEmailMessage,
  getApplicationStatusEmailLabel,
} from '../shared/applicationStatusMessages';
import { getPassportStatusEmailCopy } from '../shared/passportStatusMessages';
import {
  buildStatusUpdateEmailHtml,
  STATUS_UPDATE_EMAIL_SUBJECT,
} from '../shared/statusUpdateEmail';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(VisaApplication)
    private visaApplicationModel: typeof VisaApplication,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(EmailTemplate)
    private emailTemplateModel: typeof EmailTemplate,
    @InjectModel(EmailLog)
    private emailLogModel: typeof EmailLog,
    private sequelize: Sequelize
  ) {}

  /**
   * Get application overview - all applications with their status
   */
  async getApplicationOverview(): Promise<any> {
    try {
      const applications = await this.visaApplicationModel.findAll({
        order: [['createdAt', 'DESC']],
        attributes: [
          'id',
          'email',
          'country',
          'visaTypeId',
          'selectedVisaType',
          'orderId',
          'amountPaid',
          'applicationStatus',
          'numberOfTravellers',
          'travelersData',
          'currentStep',
          'completedSteps',
          'stepProgress',
          'createdAt',
          'updatedAt'
        ]
      });

      const stats = await this.calculateApplicationStats();

      return {
        applications: applications.map(app => this.formatApplicationResponse(app)),
        stats,
        total: applications.length
      };
    } catch (error) {
      console.error('Error fetching application overview:', error);
      throw new Error('Failed to fetch application overview');
    }
  }

  /**
   * Get documents overview - mock implementation since we don't have document entity yet
   */
  async getDocumentsOverview(): Promise<any> {
    try {
      const applications = await this.visaApplicationModel.findAll({
        attributes: ['id', 'travelersData', 'applicationStatus', 'country', 'createdAt', 'email']
      });

      const documents: any[] = [];

      const safeArray = (v: any) => (Array.isArray(v) ? v : v ? [v] : []);
      const isDataUrl = (s: any) => typeof s === 'string' && s.startsWith('data:');
      const normalizeDocEntry = (key: string, value: any) => {
        // Handle array of documents (like document type "1")
        if (Array.isArray(value)) {
          // For arrays, take the first document or return pending if empty
          const firstDoc = value[0];
          if (firstDoc && typeof firstDoc === 'object') {
            const previewUrl = firstDoc.preview || firstDoc.previewUrl || firstDoc.url || firstDoc.fileUrl || null;
            const downloadUrl = firstDoc.downloadUrl || firstDoc.url || firstDoc.fileUrl || previewUrl || null;
            const status = firstDoc.status || (previewUrl ? 'uploaded' : 'pending');
            const type = firstDoc.type || undefined;
            const name = firstDoc.name || undefined;
            const size = firstDoc.size || undefined;
            return { previewUrl, downloadUrl, status, type, name, size };
          }
          return { previewUrl: null, downloadUrl: null, status: 'pending' };
        }
        
        // Handle string URLs
        if (typeof value === 'string') {
          if (isDataUrl(value)) {
            return { previewUrl: value, downloadUrl: value, status: 'uploaded' };
          }
          return { previewUrl: value, downloadUrl: value, status: 'uploaded' };
        }
        
        // Handle object documents
        if (value && typeof value === 'object') {
           const previewUrl = value.preview || value.previewUrl || value.url || value.fileUrl || 
                             (isDataUrl(value.base64) ? value.base64 : (value.base64 ? `data:image/png;base64,${value.base64}` : null)) || null;
          const downloadUrl = value.downloadUrl || value.url || value.fileUrl || previewUrl || null;
          const status = value.status || (previewUrl ? 'uploaded' : 'pending');
          const type = value.type || undefined;
          const name = value.name || undefined;
          const size = value.size || undefined;
          return { previewUrl, downloadUrl, status, type, name, size };
        }
        
        return { previewUrl: null, downloadUrl: null, status: 'pending' };
      };

      for (const app of applications) {
        let travelers: any[] = [];
        try {
          const raw = typeof app.travelersData === 'string' ? JSON.parse(app.travelersData) : app.travelersData;
          travelers = safeArray(raw);
        } catch (e) {
          travelers = [];
        }

        travelers.forEach((traveler: any, index: number) => {
          const firstName = traveler?.basicDetails?.firstName || 'Traveler';
          const lastName = traveler?.basicDetails?.lastName || String(index + 1);
          const fullName = `${firstName} ${lastName}`.trim();
          const passportFront = traveler?.basicDetails?.passportFront;
          const passportBack = traveler?.basicDetails?.passportBack;

          if (passportFront) {
            const meta = normalizeDocEntry('passportFront', passportFront);
            documents.push({
              id: `${app.id}-${index}-passport-front`,
              applicationId: app.id,
              travelerId: traveler?.id ?? index,
              name: `Passport Front - ${fullName}`,
              type: 'passport-front',
              uploadedAt: app.createdAt,
              ...meta,
            });
          }
          if (passportBack) {
            const meta = normalizeDocEntry('passportBack', passportBack);
            documents.push({
              id: `${app.id}-${index}-passport-back`,
              applicationId: app.id,
              travelerId: traveler?.id ?? index,
              name: `Passport Back - ${fullName}`,
              type: 'passport-back',
              uploadedAt: app.createdAt,
              ...meta,
            });
          }

          const docsContainer = traveler?.documents?.documents || traveler?.documents || {};
          if (docsContainer && typeof docsContainer === 'object') {
            Object.keys(docsContainer).forEach((docKey) => {
              const value = docsContainer[docKey];
              const meta = normalizeDocEntry(docKey, value);
              const documentTypeName = this.getDocumentTypeName(docKey);
              const name = meta.name || `${documentTypeName} - ${fullName}`;
              const type = meta.type || this.getDocumentTypeSlug(docKey);
              documents.push({
                id: `${app.id}-${index}-${String(docKey)}`,
                applicationId: app.id,
                travelerId: traveler?.id ?? index,
                name,
                type,
                uploadedAt: app.createdAt,
                ...meta,
              });
            });
          }
        });
      }

      const stats = this.calculateDocumentStats(documents);

      return {
        documents,
        stats,
        total: documents.length,
      };
    } catch (error) {
      console.error('Error fetching documents overview:', error);
      throw new Error('Failed to fetch documents overview');
    }
  }

  async getTravelerDocumentsReal(applicationId: string, travelerId: string | number): Promise<any> {
    try {
      const app = await this.visaApplicationModel.findByPk(applicationId, { attributes: ['id', 'travelersData', 'createdAt'] });
      if (!app) throw new Error('Application not found');
      let travelers: any[] = [];
      try {
        const raw = typeof app.travelersData === 'string' ? JSON.parse(app.travelersData) : app.travelersData;
        travelers = Array.isArray(raw) ? raw : raw ? [raw] : [];
      } catch (e) { travelers = []; }

      // Support either 0-based index or matching traveler.id
      const idxNum = Number(travelerId);
      let traveler = travelers.find(t => t?.id === idxNum) ?? travelers[idxNum] ?? null;
      if (!traveler) return { documents: [] };

      const out: any[] = [];
      const isDataUrl = (s: any) => typeof s === 'string' && s.startsWith('data:');
      const norm = (key: string, value: any) => {
        // Handle array of documents (like document type "1")
        if (Array.isArray(value)) {
          // For arrays, take the first document or return pending if empty
          const firstDoc = value[0];
          if (firstDoc && typeof firstDoc === 'object') {
            const previewUrl = firstDoc.preview || firstDoc.previewUrl || firstDoc.url || firstDoc.fileUrl || null;
            const downloadUrl = firstDoc.downloadUrl || firstDoc.url || firstDoc.fileUrl || previewUrl || null;
            const status = firstDoc.status || (previewUrl ? 'uploaded' : 'pending');
            const type = firstDoc.type || undefined;
            const name = firstDoc.name || undefined;
            const size = firstDoc.size || undefined;
            return { previewUrl, downloadUrl, status, type, name, size };
          }
          return { previewUrl: null, downloadUrl: null, status: 'pending' };
        }
        
        // Handle string URLs
        if (typeof value === 'string') {
          if (isDataUrl(value)) {
            return { previewUrl: value, downloadUrl: value, status: 'uploaded' };
          } else {
            return { previewUrl: value, downloadUrl: value, status: 'uploaded' };
          }
        }
        
        // Handle object documents
        if (value && typeof value === 'object') {
          const previewUrl = value.preview || value.previewUrl || value.url || value.fileUrl || 
                            (isDataUrl(value.base64) ? value.base64 : (value.base64 ? `data:image/png;base64,${value.base64}` : null)) || null;
          const downloadUrl = value.downloadUrl || value.url || value.fileUrl || previewUrl || null;
          const status = value.status || (previewUrl ? 'uploaded' : 'pending');
          const type = value.type || undefined;
          const name = value.name || undefined;
          const size = value.size || undefined;
          return { previewUrl, downloadUrl, status, type, name, size };
        }
        
        return { previewUrl: null, downloadUrl: null, status: 'pending' };
      };

      const firstName = traveler?.basicDetails?.firstName || 'Traveler';
      const lastName = traveler?.basicDetails?.lastName || String(idxNum);
      const fullName = `${firstName} ${lastName}`.trim();

      if (traveler?.basicDetails?.passportFront) {
        const meta = norm('passportFront', traveler.basicDetails.passportFront);
        out.push({
          id: `${applicationId}-${idxNum}-passport-front`,
          applicationId,
          travelerId: traveler?.id ?? idxNum,
          name: `Passport Front - ${fullName}`,
          type: 'passport-front',
          uploadedAt: app.createdAt,
          ...meta,
        });
      }
      if (traveler?.basicDetails?.passportBack) {
        const meta = norm('passportBack', traveler.basicDetails.passportBack);
        out.push({
          id: `${applicationId}-${idxNum}-passport-back`,
          applicationId,
          travelerId: traveler?.id ?? idxNum,
          name: `Passport Back - ${fullName}`,
          type: 'passport-back',
          uploadedAt: app.createdAt,
          ...meta,
        });
      }

          const docsContainer = traveler?.documents?.documents || traveler?.documents || {};
          if (docsContainer && typeof docsContainer === 'object') {
            Object.keys(docsContainer).forEach((docKey) => {
              const value = docsContainer[docKey];
              const meta = norm(docKey, value);
              const documentTypeName = this.getDocumentTypeName(docKey);
              const name = meta.name || `${documentTypeName} - ${fullName}`;
              const type = meta.type || this.getDocumentTypeSlug(docKey);
              out.push({
                id: `${applicationId}-${idxNum}-${String(docKey)}`,
                applicationId,
                travelerId: traveler?.id ?? idxNum,
                name,
                type,
                uploadedAt: app.createdAt,
                ...meta,
              });
            });
          }      return { documents: out };
    } catch (e) {
      console.error('Error fetching traveler documents:', e);
      throw new Error('Failed to fetch traveler documents');
    }
  }

  /**
   * Search applications with filters
   */
  async searchApplications(searchDto: SearchApplicationsDto): Promise<any> {
    try {
      const {
        query,
        type = SearchType.ALL,
        status,
        country,
        dateFrom,
        dateTo,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
        page = '1',
        limit = '50',
        assignedAdminEmail,
        assignedAdminId,
      } = searchDto;

      const andParts: any[] = [];

      // Text search
      if (query && query.trim()) {
        const searchQuery = query.trim();
        const likeQuery = `%${searchQuery}%`;
        const idIlike = where(cast(col('id'), 'TEXT'), { [Op.iLike]: likeQuery });
        const orderIdIlike = where(cast(col('orderId'), 'TEXT'), { [Op.iLike]: likeQuery });

        switch (type) {
          case SearchType.APPLICATION_ID:
            andParts.push({
              [Op.or]: [idIlike, orderIdIlike],
            });
            break;
          case SearchType.ORDER_ID:
            andParts.push(orderIdIlike);
            break;
          default: // ALL
            andParts.push({
              [Op.or]: [
                idIlike,
                orderIdIlike,
                { country: { [Op.iLike]: likeQuery } },
                { email: { [Op.iLike]: likeQuery } },
              ],
            });
        }
      }

      // Status filter
      if (status) {
        andParts.push({ applicationStatus: status });
      }

      // Country filter
      if (country) {
        andParts.push({ country: { [Op.iLike]: `%${country}%` } });
      }

      // Date range filter
      if (dateFrom || dateTo) {
        const dateFilter: any = {};
        if (dateFrom) {
          dateFilter[Op.gte] = new Date(dateFrom);
        }
        if (dateTo) {
          dateFilter[Op.lte] = new Date(dateTo + 'T23:59:59.999Z');
        }
        andParts.push({ createdAt: dateFilter });
      }

      if (assignedAdminId?.trim() && assignedAdminEmail?.trim()) {
        andParts.push({
          [Op.or]: [
            { assignedAdminId: assignedAdminId.trim() },
            {
              assignedAdminEmail: {
                [Op.iLike]: assignedAdminEmail.trim(),
              },
            },
          ],
        });
      } else if (assignedAdminId?.trim()) {
        andParts.push({ assignedAdminId: assignedAdminId.trim() });
      } else if (assignedAdminEmail?.trim()) {
        andParts.push({
          assignedAdminEmail: {
            [Op.iLike]: assignedAdminEmail.trim(),
          },
        });
      }

      const whereConditions =
        andParts.length === 0
          ? {}
          : andParts.length === 1
            ? andParts[0]
            : { [Op.and]: andParts };

      // Pagination
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const offset = (pageNum - 1) * limitNum;

      const { count, rows } = await this.visaApplicationModel.findAndCountAll({
        where: whereConditions,
        order: [[sortBy, sortOrder]],
        limit: limitNum,
        offset: offset,
        attributes: [
          'id',
          'email',
          'country',
          'visaTypeId',
          'selectedVisaType',
          'orderId',
          'amountPaid',
          'applicationStatus',
          'numberOfTravellers',
          'travelersData',
          'currentStep',
          'completedSteps',
          'stepProgress',
          'assignedAdminId',
          'assignedAdminEmail',
          'assignedAdminName',
          'createdAt',
          'updatedAt'
        ]
      });

      return {
        applications: rows.map(app => this.formatApplicationResponse(app)),
        pagination: {
          total: count,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(count / limitNum)
        }
      };
    } catch (error) {
      console.error('Error searching applications:', error);
      throw new Error('Failed to search applications');
    }
  }

  /**
   * Get detailed application information
   */
  async getApplicationDetails(getDetailsDto: GetApplicationDetailsDto): Promise<any> {
    try {
      const application = await this.visaApplicationModel.findByPk(getDetailsDto.applicationId);

      if (!application) {
        throw new Error('Application not found');
      }

      return this.formatApplicationResponse(application);
    } catch (error) {
      console.error('Error fetching application details:', error);
      throw new Error('Failed to fetch application details');
    }
  }

  /**
   * Send email and log it to database
   */
  async sendEmailAndLog(emailData: {
    emailAddress: string;
    subject: string;
    body: string;
    excludeDecorativeImage?: boolean;
    templateKey?: string;
    templateName?: string;
    templateVariables?: any;
    applicationId?: string;
    userId?: string;
    recipientName?: string;
  }, footerContent?: any): Promise<any> {
    let messageId: string | null = null;
    let status = 'sent';
    let errorMessage: string | null = null;
    let htmlContent = '';

    try {
      // Get footer content if not provided
      if (!footerContent) {
        footerContent = await this.getEmailFooterContent();
      }

      // Send the email
      const result = await sendEmail(emailData, footerContent);
      messageId = result?.messageId || null;
      
      // Get the HTML content that was sent
      htmlContent = getEmailTemplateHeaderFooter(
        emailData.body,
        footerContent,
        emailData.excludeDecorativeImage || false
      );

      // Log successful email
      await this.emailLogModel.create({
        recipientEmail: emailData.emailAddress,
        recipientName: emailData.recipientName || null,
        subject: emailData.subject,
        body: emailData.body,
        htmlContent: htmlContent,
        templateKey: emailData.templateKey || null,
        templateName: emailData.templateName || null,
        templateVariables: emailData.templateVariables || null,
        applicationId: emailData.applicationId || null,
        userId: emailData.userId || null,
        status: 'sent',
        messageId: messageId,
      });

      return result;
    } catch (error: any) {
      status = 'failed';
      errorMessage = error.message || 'Unknown error';
      
      // Get HTML content even for failed emails
      try {
        if (!footerContent) {
          footerContent = await this.getEmailFooterContent();
        }
        htmlContent = getEmailTemplateHeaderFooter(
          emailData.body,
          footerContent,
          emailData.excludeDecorativeImage || false
        );
      } catch {}

      // Log failed email
      try {
        await this.emailLogModel.create({
          recipientEmail: emailData.emailAddress,
          recipientName: emailData.recipientName || null,
          subject: emailData.subject,
          body: emailData.body,
          htmlContent: htmlContent,
          templateKey: emailData.templateKey || null,
          templateName: emailData.templateName || null,
          templateVariables: emailData.templateVariables || null,
          applicationId: emailData.applicationId || null,
          userId: emailData.userId || null,
          status: 'failed',
          errorMessage: errorMessage,
        });
      } catch (logError) {
        // Don't fail if logging fails
        console.error('Failed to save email log:', logError);
      }

      throw error;
    }
  }

  /**
   * Update application status
   */
  async updateApplicationStatus(updateDto: UpdateApplicationStatusDto): Promise<any> {
    try {
      // Validate input
      if (!updateDto.applicationId) {
        throw new Error('Application ID is required');
      }
      if (!updateDto.status) {
        throw new Error('Status is required');
      }
      
      const application = await this.visaApplicationModel.findByPk(updateDto.applicationId);

      if (!application) {
        throw new Error(`Application not found with ID: ${updateDto.applicationId}`);
      }

      const oldStatus = application.applicationStatus;
      const existingStepData =
        application.stepData && typeof application.stepData === 'object'
          ? application.stepData
          : {};
      const statusDisplay =
        updateDto.statusDisplay ||
        updateDto.newStatus ||
        updateDto.statusMessage ||
        null;
      const adminStatusKey = updateDto.adminStatusKey || null;

      await application.update({
        applicationStatus: updateDto.status,
        stepData: {
          ...existingStepData,
          ...(adminStatusKey ? { adminStatusKey } : {}),
          ...(statusDisplay ? { statusDisplay, statusMessage: updateDto.statusMessage || statusDisplay } : {}),
        },
        updatedAt: new Date(),
      });

      await this.logApplicationActivity({
        applicationId: updateDto.applicationId,
        type: 'status_change',
        description: `Status changed from ${oldStatus || 'unknown'} to ${updateDto.status}`,
        adminId: updateDto.adminId,
        adminEmail: undefined,
        details: {
          from: oldStatus,
          to: updateDto.status,
          notes: updateDto.notes || null,
        },
      });

      // Reload the application to get the updated values
      await application.reload();

      const shouldNotify = updateDto.sendNotification !== false;
      console.log('[status-update] saved', {
        applicationId: updateDto.applicationId,
        status: updateDto.status,
        adminStatusKey,
        statusDisplay,
        sendNotification: shouldNotify,
      });

      // Send email notification to user
      if (!shouldNotify) {
        console.log('[status-update] email skipped (sendNotification=false)');
        return this.formatApplicationResponse(application);
      }

      try {
        const passportCopy = getPassportStatusEmailCopy(adminStatusKey);
        const emailStatusLabel = passportCopy
          ? passportCopy.label
          : getApplicationStatusEmailLabel(updateDto.status);
        const message = passportCopy
          ? passportCopy.message
          : getApplicationStatusEmailMessage(updateDto.status);

        const applicationNo =
          (application as any).formattedApplicationId ||
          (application as any).applicationNo ||
          (application as any).code ||
          String(application.id).slice(0, 8);

        const emailSubject = STATUS_UPDATE_EMAIL_SUBJECT(applicationNo);
        const emailBody = buildStatusUpdateEmailHtml(
          emailStatusLabel,
          message,
          updateDto.notes,
        );
        const footerContent = await this.getEmailFooterContent();

        await this.sendEmailAndLog(
          {
            emailAddress: application.email,
            subject: emailSubject,
            body: emailBody,
            templateKey: 'status_update',
            templateName: 'Application Status Update',
            templateVariables: {
              status: emailStatusLabel,
              message,
              notes: updateDto.notes || '',
              applicationNo,
            },
            applicationId: application.id,
            recipientName: 'Applicant',
          },
          footerContent,
        );
        
        console.log('[status-update] email sent', {
          to: application.email,
          from: oldStatus,
          toStatus: updateDto.status,
          label: emailStatusLabel,
        });
      } catch (emailError) {
        console.error('[status-update] email failed', emailError);
        // Don't throw error here, just log it
      }

      // Here you could also log the status change in an audit table
      // await this.logStatusChange(updateDto);

      return this.formatApplicationResponse(application);
    } catch (error) {
      console.error('Error updating application status:', error);
      throw new Error('Failed to update application status');
    }
  }

  /**
   * Get application statistics
   */
  async getApplicationStats(filters?: any): Promise<any> {
    try {
      return await this.calculateApplicationStats(filters);
    } catch (error) {
      console.error('Error calculating application stats:', error);
      throw new Error('Failed to calculate application stats');
    }
  }

  async logApplicationActivity(data: {
    applicationId: string;
    type: string;
    description: string;
    adminId?: string;
    adminEmail?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.sequelize.query(
        `
        INSERT INTO application_activities
          (application_id, type, description, admin_id, admin_email, details, created_at)
        VALUES
          (:applicationId, :type, :description, :adminId, :adminEmail, :details::jsonb, NOW())
        `,
        {
          replacements: {
            applicationId: data.applicationId,
            type: data.type,
            description: data.description,
            adminId: data.adminId || null,
            adminEmail: data.adminEmail || null,
            details: JSON.stringify(data.details || {}),
          },
          type: QueryTypes.INSERT,
        }
      );
    } catch (error) {
      console.error('Failed to log application activity:', error);
    }
  }

  /**
   * Get application activity log
   */
  async getApplicationActivity(applicationId: string): Promise<any> {
    try {
      const application = await this.visaApplicationModel.findByPk(applicationId);

      if (!application) {
        throw new Error('Application not found');
      }

      const rows = (await this.sequelize.query(
        `
        SELECT id, type, description, admin_id AS "adminId", admin_email AS "adminEmail",
               details, created_at AS "timestamp"
        FROM application_activities
        WHERE application_id = :applicationId
        ORDER BY created_at DESC
        LIMIT 100
        `,
        {
          replacements: { applicationId },
          type: QueryTypes.SELECT,
        }
      )) as Array<Record<string, unknown>>;

      const seeded = [
        {
          id: 'seed-submitted',
          type: 'status_change',
          description: 'Application created',
          timestamp: application.createdAt,
          adminId: null,
          adminEmail: null,
          details: { to: application.applicationStatus || 'submitted' },
        },
        ...rows,
      ];

      return {
        applicationId,
        activities: seeded,
      };
    } catch (error) {
      console.error('Error fetching application activity:', error);
      throw new Error('Failed to fetch application activity');
    }
  }

  /**
   * Get application comments (customer-agent discussions)
   */
  async getApplicationComments(applicationId: string): Promise<any> {
    try {
      const application = await this.visaApplicationModel.findByPk(applicationId);

      if (!application) {
        throw new Error('Application not found');
      }

      const comments = (await this.sequelize.query(
        `
        SELECT id, comment, is_internal AS "isInternal", author_type AS "authorType",
               author_id AS "authorId", author_email AS "authorEmail",
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM application_comments
        WHERE application_id = :applicationId
        ORDER BY created_at DESC
        LIMIT 200
        `,
        {
          replacements: { applicationId },
          type: QueryTypes.SELECT,
        }
      )) as Array<Record<string, unknown>>;

      return {
        applicationId,
        comments,
      };
    } catch (error) {
      console.error('Error fetching application comments:', error);
      throw new Error('Failed to fetch application comments');
    }
  }

  /**
   * Add comment to application
   */
  async addApplicationComment(data: {
    applicationId: string;
    comment: string;
    isInternal: boolean;
    adminId?: string;
    adminEmail?: string;
  }): Promise<any> {
    try {
      const application = await this.visaApplicationModel.findByPk(data.applicationId);

      if (!application) {
        throw new Error('Application not found');
      }

      const inserted = (await this.sequelize.query(
        `
        INSERT INTO application_comments
          (application_id, comment, is_internal, author_type, author_id, author_email, created_at, updated_at)
        VALUES
          (:applicationId, :comment, :isInternal, 'admin', :adminId, :adminEmail, NOW(), NOW())
        RETURNING id, comment, is_internal AS "isInternal", author_id AS "adminId",
                  author_email AS "adminEmail", created_at AS "createdAt", updated_at AS "updatedAt"
        `,
        {
          replacements: {
            applicationId: data.applicationId,
            comment: data.comment,
            isInternal: Boolean(data.isInternal),
            adminId: data.adminId || null,
            adminEmail: data.adminEmail || null,
          },
          type: QueryTypes.SELECT,
        }
      )) as Array<Record<string, unknown>>;

      const newComment = inserted?.[0] || null;

      await this.logApplicationActivity({
        applicationId: data.applicationId,
        type: 'comment',
        description: data.isInternal
          ? 'Internal note added'
          : 'Message sent to customer',
        adminId: data.adminId,
        adminEmail: data.adminEmail,
        details: { isInternal: data.isInternal },
      });

      if (!data.isInternal && application.email) {
        try {
          await sendEmail({
            emailAddress: application.email,
            subject: 'New message about your NUvisa application',
            body: `<p>Hello,</p><p>Our team has sent you a message regarding your visa application:</p><blockquote>${data.comment}</blockquote><p>— Team NUvisa</p>`,
          });
        } catch (emailError) {
          console.error('Failed to notify customer of comment:', emailError);
        }
      }

      return {
        applicationId: data.applicationId,
        comment: newComment,
      };
    } catch (error) {
      console.error('Error adding application comment:', error);
      throw new Error('Failed to add application comment');
    }
  }

  async assignApplication(data: {
    applicationId: string;
    assignedAdminId?: string;
    assignedAdminEmail?: string;
    assignedAdminName?: string;
    adminId?: string;
    adminEmail?: string;
  }): Promise<any> {
    const application = await this.visaApplicationModel.findByPk(data.applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    await application.update({
      assignedAdminId: data.assignedAdminId || null,
      assignedAdminEmail: data.assignedAdminEmail || null,
      assignedAdminName: data.assignedAdminName || null,
    });

    await this.logApplicationActivity({
      applicationId: data.applicationId,
      type: 'assignment',
      description: `Assigned to ${data.assignedAdminName || data.assignedAdminEmail || 'unassigned'}`,
      adminId: data.adminId,
      adminEmail: data.adminEmail,
      details: {
        assignedAdminId: data.assignedAdminId,
        assignedAdminEmail: data.assignedAdminEmail,
        assignedAdminName: data.assignedAdminName,
      },
    });

    return this.formatApplicationResponse(application);
  }

  async getTeamMembers(): Promise<any[]> {
    try {
      const rows = (await this.sequelize.query(
        `SELECT value FROM site_content WHERE key = 'team_members' LIMIT 1`,
        { type: QueryTypes.SELECT }
      )) as Array<{ value: string }>;

      if (rows?.[0]?.value) {
        const parsed = JSON.parse(rows[0].value);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // fall through
    }

    return [
      { id: 'admin-1', name: 'NUvisa Admin', email: 'admin@nuvisa.co.uk' },
    ];
  }

  async getHomepageCmsContent(): Promise<Record<string, string>> {
    const keys = [
      'topdestination_title',
      'topdestination_subtitle',
      'topdestination_countries',
      'price_match_title',
      'price_match_description',
      'price_match_tooltip',
      'occasion_section_title',
      'occasion_section_subtitle',
      'ocassion_title',
      'ocassion_subtitle',
      'occasions_json',
      'visasolution_title',
      'visasolution_subtitle',
      'visasolution_everyday_countries',
    ];

    const rows = (await this.sequelize.query(
      `SELECT key, value FROM site_content WHERE key IN (:keys)`,
      {
        replacements: { keys },
        type: QueryTypes.SELECT,
      }
    )) as Array<{ key: string; value: string }>;

    const byKey: Record<string, string> = {};
    rows.forEach((row) => {
      if (row?.key) byKey[row.key] = row.value;
    });
    return byKey;
  }

  async updateHomepageCmsContent(
    updates: Record<string, string>,
    updatedBy?: string
  ): Promise<Record<string, string>> {
    const allowedKeys = new Set([
      'topdestination_title',
      'topdestination_subtitle',
      'topdestination_countries',
      'price_match_title',
      'price_match_description',
      'price_match_tooltip',
      'occasion_section_title',
      'occasion_section_subtitle',
      'ocassion_title',
      'ocassion_subtitle',
      'occasions_json',
      'visasolution_title',
      'visasolution_subtitle',
      'visasolution_everyday_countries',
    ]);

    await this.sequelize.transaction(async (transaction) => {
      for (const [key, value] of Object.entries(updates || {})) {
        if (!allowedKeys.has(key)) continue;
        await this.sequelize.query(
          `
          INSERT INTO site_content (key, value, type, created_at, updated_at, updated_by)
          VALUES (:key, :value, 'text', NOW(), NOW(), :updatedBy)
          ON CONFLICT (key)
          DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by
          `,
          {
            replacements: { key, value: String(value ?? ''), updatedBy: updatedBy || null },
            type: QueryTypes.INSERT,
            transaction,
          }
        );
      }
    });

    return this.getHomepageCmsContent();
  }

  async submitFeedback(data: {
    name?: string;
    email: string;
    message: string;
    rating?: number;
  }): Promise<any> {
    const inserted = (await this.sequelize.query(
      `
      INSERT INTO feedback_submissions (name, email, message, rating, created_at)
      VALUES (:name, :email, :message, :rating, NOW())
      RETURNING id, created_at AS "createdAt"
      `,
      {
        replacements: {
          name: data.name || null,
          email: data.email,
          message: data.message,
          rating: data.rating ?? null,
        },
        type: QueryTypes.SELECT,
      }
    )) as Array<Record<string, unknown>>;

    try {
      await sendEmail({
        emailAddress: process.env.FEEDBACK_NOTIFY_EMAIL || 'support@nuvisa.co.uk',
        subject: 'New NUvisa feedback submission',
        body: `<p><strong>From:</strong> ${data.name || 'Anonymous'} (${data.email})</p>
               <p><strong>Rating:</strong> ${data.rating ?? 'N/A'}</p>
               <p>${data.message}</p>`,
      });
    } catch (error) {
      console.error('Feedback notify email failed:', error);
    }

    return inserted?.[0] || { success: true };
  }

  async getFeedbackSubmissions(options?: {
    page?: number;
    limit?: number;
  }): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const page = Math.max(1, Number(options?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options?.limit) || 50));
    const offset = (page - 1) * limit;

    const countRows = (await this.sequelize.query(
      `SELECT COUNT(*)::int AS total FROM feedback_submissions`,
      { type: QueryTypes.SELECT }
    )) as Array<{ total: number }>;

    const items = (await this.sequelize.query(
      `
      SELECT id, name, email, message, rating, created_at AS "createdAt"
      FROM feedback_submissions
      ORDER BY created_at DESC
      LIMIT :limit OFFSET :offset
      `,
      {
        replacements: { limit, offset },
        type: QueryTypes.SELECT,
      }
    )) as Array<Record<string, unknown>>;

    return {
      items,
      total: countRows?.[0]?.total ?? 0,
    };
  }

  async sendInsurancePurchaseConfirmation(data: {
    email: string;
    amount?: string | number;
    applicationId?: string;
    orderId?: string;
  }): Promise<void> {
    if (!data.email) return;

    const amountText =
      data.amount !== undefined && data.amount !== null && data.amount !== ''
        ? `£${Number(data.amount).toFixed(2)}`
        : 'your insurance payment';

    const body = `
      <div style="font-family: Arial, sans-serif; color: #111;">
        <h2 style="color: #7350FF;">Insurance purchase successful</h2>
        <p>Thank you for purchasing your NUvisa insurance certificate (${amountText}).</p>
        <p>Your payment has been recorded${data.applicationId ? ' on your existing application.' : '.'}</p>
        ${data.orderId ? `<p><strong>Reference:</strong> ${data.orderId}</p>` : ''}
        <p>If you have questions, reply to this email or contact our support team.</p>
        <p>— Team NUvisa</p>
      </div>
    `;

    try {
      // Get footer content for a complete email
      const footerContent = await this.getEmailFooterContent();
      await sendEmail({
        emailAddress: data.email,
        subject: 'NUvisa — Insurance purchase confirmed',
        body,
      }, footerContent);
    } catch (error) {
      console.error('Failed to send insurance confirmation email:', error?.message);
      // Fall back to sending without footer
      try {
        await sendEmail({
          emailAddress: data.email,
          subject: 'NUvisa — Insurance purchase confirmed',
          body,
        });
      } catch (fallbackError) {
        console.error('Fallback email also failed:', fallbackError?.message);
      }
    }
  }

  /**
   * Private helper methods
   */
  private formatApplicationResponse(application: VisaApplication): any {
    const appData = application.toJSON();
    
    // Parse travelers data safely
    let travelersData = [];
    try {
      if (appData.travelersData) {
        travelersData = typeof appData.travelersData === 'string' 
          ? JSON.parse(appData.travelersData)
          : appData.travelersData;
        
        if (!Array.isArray(travelersData)) {
          travelersData = [travelersData];
        }
      }
    } catch (error) {
      console.error('Error parsing travelers data:', error);
      travelersData = [];
    }

  let orderId = appData.orderId || null;
    try {
      if (!orderId && Array.isArray(travelersData) && travelersData.length > 0) {
        const firstTraveler = travelersData[0];
        if (firstTraveler) {
          if (firstTraveler.insurance && firstTraveler.insurance.orderId) {
            orderId = firstTraveler.insurance.orderId;
          } else if (firstTraveler.payment && firstTraveler.payment.orderId) {
            orderId = firstTraveler.payment.orderId;
          }
        }
      }
      if (!orderId) {
        orderId = appData.id;
      }
    } catch {
    }

    const applicationId = appData.id !== undefined && appData.id !== null ? String(appData.id) : '';

    // Format application and order IDs consistently
    const formatApplicationId = (rawId) => {
      if (!rawId) return null;
      const numericTail = (source, length) => {
        if (!source) return "".padStart(length, "0");
        let digits = String(source).replace(/\D+/g, "");
        if (digits.length < length) {
          const codes = Array.from(String(source))
            .map((c) => c.charCodeAt(0))
            .join("");
          digits = (digits + codes).replace(/\D+/g, "");
        }
        if (!digits.length) {
          digits = "0".repeat(length);
        }
        return digits.slice(-length).padStart(length, "0");
      };
      return `AI${numericTail(rawId, 8)}`;
    };

    const formatOrderId = (rawOrderId) => {
      if (!rawOrderId) return null;
      const numericTail = (source, length) => {
        if (!source) return "".padStart(length, "0");
        let digits = String(source).replace(/\D+/g, "");
        if (digits.length < length) {
          const codes = Array.from(String(source))
            .map((c) => c.charCodeAt(0))
            .join("");
          digits = (digits + codes).replace(/\D+/g, "");
        }
        if (!digits.length) {
          digits = "0".repeat(length);
        }
        return digits.slice(-length).padStart(length, "0");
      };
      return `ORD${numericTail(rawOrderId, 6)}`;
    };

    const stepMeta =
      appData.stepData && typeof appData.stepData === 'object' ? appData.stepData : {};

    return {
      ...appData,
      applicationId,
      travelersData,
      orderId,
      formattedApplicationId: formatApplicationId(applicationId),
      formattedOrderId: formatOrderId(orderId),
      code: formatOrderId(orderId) || formatApplicationId(applicationId),
      status: appData.applicationStatus,
      applicationStatus: appData.applicationStatus,
      adminStatusKey: stepMeta.adminStatusKey || null,
      statusDisplay: stepMeta.statusDisplay || stepMeta.statusMessage || null,
      statusMessage: stepMeta.statusMessage || stepMeta.statusDisplay || null,
    };
  }

  private async calculateApplicationStats(filters?: any): Promise<any> {
    try {
      const whereCondition = filters || {};

      const total = await this.visaApplicationModel.count({ where: whereCondition });
      
      // Comprehensive status mapping for accurate categorization
      const pending = await this.visaApplicationModel.count({
        where: { 
          ...whereCondition, 
          applicationStatus: { 
            [Op.in]: [
              'new', 'draft', 'pending', 
              'PENDING' // Only draft/new/pending, NOT submitted
            ] 
          } 
        },
      });
      
      const submitted = await this.visaApplicationModel.count({
        where: { 
          ...whereCondition, 
          applicationStatus: { 
            [Op.in]: [
              'submitted', 'SUBMITTED' // Submitted applications stay as submitted
            ] 
          } 
        },
      });
      
      const in_progress = await this.visaApplicationModel.count({
        where: { 
          ...whereCondition, 
          applicationStatus: { 
            [Op.in]: [
              'under_review', 'processing', 'appointment_booked', 'at_embassy',
              'UNDER_REVIEW', 'APPOINTMENT_BOOKED', 'AT_EMBASSY' // Include both variants
            ] 
          } 
        },
      });
      
      const completed = await this.visaApplicationModel.count({
        where: { 
          ...whereCondition, 
          applicationStatus: { 
            [Op.in]: ['completed', 'COMPLETED'] // Only completed, not approved
          } 
        },
      });
      
      const approved = await this.visaApplicationModel.count({
        where: { 
          ...whereCondition, 
          applicationStatus: { 
            [Op.in]: ['approved', 'APPROVED'] // Separate approved from completed
          } 
        },
      });
      
      const rejected = await this.visaApplicationModel.count({
        where: { 
          ...whereCondition, 
          applicationStatus: { 
            [Op.in]: ['rejected', 'cancelled', 'REJECTED', 'CANCELLED'] // Include both variants
          } 
        },
      });

      return { 
        total, 
        pending, 
        submitted, // Add submitted count
        in_progress, 
        completed, 
        approved, // Add separate approved count
        rejected 
      };
    } catch (error) {
      console.error('Error calculating stats:', error);
      return { 
        total: 0, 
        pending: 0, 
        submitted: 0, // Add submitted count
        in_progress: 0, 
        completed: 0, 
        approved: 0, 
        rejected: 0 
      };
    }
  }

  private calculateDocumentStats(documents: any[]): any {
    const stats = {
      total: documents.length,
      uploaded: 0,
      pending: 0,
      approved: 0,
      rejected: 0
    };

    documents.forEach(doc => {
      switch (doc.status) {
        case 'uploaded':
          stats.uploaded++;
          break;
        case 'pending':
          stats.pending++;
          break;
        case 'approved':
          stats.approved++;
          break;
        case 'rejected':
          stats.rejected++;
          break;
      }
    });

    return stats;
  }

  /**
   * Get distinct users that have at least one application submitted
   */
  async getApplicantsWithApplications(params?: { search?: string; page?: number; limit?: number; sortBy?: string; sortOrder?: 'ASC' | 'DESC'; }): Promise<any> {
    const page = Number(params?.page ?? 1) || 1;
    const limit = Number(params?.limit ?? 20) || 20;
    const offset = (page - 1) * limit;
    const allowedSortBy = new Set(['id', 'createdAt', 'updatedAt', 'first_name', 'last_name', 'email']);
    const sortByRaw = params?.sortBy || 'createdAt';
    const sortBy = allowedSortBy.has(sortByRaw) ? sortByRaw : 'createdAt';
    const sortOrder = String(params?.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const search = (params?.search || '').trim();

    // Build where for applications (only those with a non-null email)
    const appWhere: any = { email: { [Op.ne]: null } };
    // Optional: could filter only certain statuses if "submitted" implies a status value.

    // Build where for user search against user fields
    const userWhereParts: any[] = [];
    if (search) {
      const like = `%${search}%`;
      userWhereParts.push({ first_name: { [Op.iLike]: like } });
      userWhereParts.push({ last_name: { [Op.iLike]: like } });
      userWhereParts.push({ user_name: { [Op.iLike]: like } });
      userWhereParts.push({ email: { [Op.iLike]: like } });
    }

    // Query distinct applicant emails from applications
    const distinctEmailsResult = await this.visaApplicationModel.findAll({
      attributes: [[fn('DISTINCT', sqCol('email')), 'email']],
      where: appWhere,
      raw: true,
    });

    const emails = distinctEmailsResult
      .map((r: any) => r.email)
      .filter((e: any) => typeof e === 'string' && e.length > 0);

    if (emails.length === 0) {
      // Fallback: build applicants from applications table directly
      const fallback = await this.buildApplicantsFromApplications({ page, limit, search, sortBy, sortOrder });
      return fallback;
    }

    const whereUser: any = { email: { [Op.in]: emails } };
    if (userWhereParts.length > 0) {
      whereUser[Op.or] = userWhereParts;
    }

    let { count, rows } = await this.userModel.findAndCountAll({
      where: whereUser,
      order: [[sortBy, sortOrder]],
      limit,
      offset,
      raw: true,
    });

    // If ORM returns zero but table likely has rows, run raw SQL fallback
    if ((!rows || rows.length === 0) && !search) {
      const orderCol = allowedSortBy.has(sortBy) ? sortBy : 'id';
      const orderDir = sortOrder === 'ASC' ? 'ASC' : 'DESC';
      const [rawRows] = await this.sequelize.query(
        `SELECT * FROM public.users ORDER BY ${orderCol} ${orderDir} LIMIT :limit OFFSET :offset`,
        { replacements: { limit, offset } }
      );
      const [[rawCount]] = await this.sequelize.query(
        `SELECT COUNT(1) as cnt FROM public.users`
      );
      rows = Array.isArray(rawRows) ? (rawRows as any[]) : [];
      count = Number((rawCount as any)?.cnt || 0);
    }

    // For each user, compute application count
    const emailToCount: Record<string, number> = {};
    if (rows.length > 0) {
      const appCounts = await this.visaApplicationModel.findAll({
        attributes: [
          [sqCol('email'), 'email'],
          [fn('COUNT', sqCol('id')), 'applications']
        ],
        where: { email: { [Op.in]: rows.map(r => r.email) } },
        group: ['email'],
        raw: true,
      });
      for (const rec of appCounts as any[]) {
        emailToCount[String(rec.email)] = Number(rec.applications) || 0;
      }
    }

    let users = rows.map((u: any) => ({
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      user_name: u.user_name,
      email: u.email,
      phone_no: u.phone_no,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      applications: emailToCount[u.email] || 0,
    }));

    // If no users found in users table, fallback to constructing from applications
    if (users.length === 0) {
      const fallback = await this.buildApplicantsFromApplications({ page, limit, search, sortBy, sortOrder });
      return fallback;
    }

    return {
      users,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  private async buildApplicantsFromApplications(params: { page: number; limit: number; search?: string; sortBy?: string; sortOrder?: 'ASC' | 'DESC'; }) {
    const { page, limit } = params;
    const offset = (page - 1) * limit;
    const allowedSortBy = new Set(['createdAt', 'updatedAt', 'email']);
    const sortByRaw = params.sortBy || 'createdAt';
    const sortBy = allowedSortBy.has(sortByRaw) ? sortByRaw : 'createdAt';
    const sortOrder = String(params.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const search = (params.search || '').trim();

    const whereClause: any = { email: { [Op.ne]: null } };
    if (search) {
      whereClause.email = { [Op.iLike]: `%${search}%` };
    }

    // Count distinct emails
    const distinctResult = await this.visaApplicationModel.findAll({
      attributes: [[fn('DISTINCT', sqCol('email')), 'email']],
      where: whereClause,
      raw: true,
    });
    const total = distinctResult.length;

    // Aggregate by email with count and min/max dates
    const rows = await this.visaApplicationModel.findAll({
      attributes: [
        [sqCol('email'), 'email'],
        [fn('COUNT', sqCol('id')), 'applications'],
        [fn('MIN', sqCol('createdAt')), 'createdAt'],
        [fn('MAX', sqCol('updatedAt')), 'updatedAt'],
      ],
      where: whereClause,
      group: ['email'],
      order: [[sortBy === 'createdAt' ? fn('MIN', sqCol('createdAt')) : sortBy, sortOrder]],
      limit,
      offset,
      raw: true,
    });

    const users = rows.map((r: any) => ({
      id: String(r.email),
      first_name: null,
      last_name: null,
      user_name: null,
      email: r.email,
      phone_no: null,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
      applications: Number(r.applications || 0),
    }));

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get users from backend users table with pagination and search
   */
  async getBackendUsers(params?: { 
    search?: string; 
    page?: number; 
    limit?: number; 
    sortBy?: string; 
    sortOrder?: 'ASC' | 'DESC';
    dateFrom?: string;
    dateTo?: string;
  }): Promise<any> {
    const page = Number(params?.page ?? 1) || 1;
    const limit = Number(params?.limit ?? 20) || 20;
    const offset = (page - 1) * limit;
    const allowedSortBy = new Set(['createdAt', 'updatedAt', 'first_name', 'last_name', 'email']);
    const sortByRaw = params?.sortBy || 'createdAt';
    const sortBy = allowedSortBy.has(sortByRaw) ? sortByRaw : 'createdAt';
    const sortOrder = String(params?.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const search = (params?.search || '').trim();

    const whereUser: any = {};
    
    // Text search
    if (search) {
      const like = `%${search}%`;
      whereUser[Op.or] = [
        { first_name: { [Op.iLike]: like } },
        { last_name: { [Op.iLike]: like } },
        { user_name: { [Op.iLike]: like } },
        { email: { [Op.iLike]: like } },
      ];
    }

    // Date range filter
    if (params?.dateFrom || params?.dateTo) {
      const dateFilter: any = {};
      if (params.dateFrom) {
        dateFilter[Op.gte] = new Date(params.dateFrom);
      }
      if (params.dateTo) {
        dateFilter[Op.lte] = new Date(params.dateTo + 'T23:59:59.999Z');
      }
      whereUser.createdAt = dateFilter;
    }

    const { count, rows } = await this.userModel.findAndCountAll({
      where: whereUser,
      order: [[sortBy, sortOrder]],
      limit,
      offset,
      raw: true,
    });

    const users = rows.map((u: any) => ({
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      user_name: u.user_name,
      email: u.email,
      phone_no: u.phone_no,
      is_verified: u.is_verified,
      status: u.status,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    return {
      users,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Debug helper to verify connectivity and data presence
   */
  async getBackendUsersDebug(): Promise<any> {
    const count = await this.userModel.count();
    const sample = await this.userModel.findOne({ order: [['createdAt', 'DESC']], raw: true });
    return { count, sample };
  }

  /**
   * Update a backend user by id
   */
  async updateBackendUserById(id: string, data: any): Promise<any> {
    const user = await this.userModel.findByPk(id);
    if (!user) {
      throw new Error('User not found');
    }
    if (typeof data.first_name === 'string') user.first_name = data.first_name;
    if (typeof data.last_name === 'string') user.last_name = data.last_name;
    if (typeof data.user_name === 'string') user.user_name = data.user_name;
    if (typeof data.phone_no === 'string') user.phone_no = data.phone_no;
    if (typeof data.isVerified === 'boolean') user.set('is_verified', data.isVerified);
    if (typeof data.status === 'string') user.set('status', data.status);
    await user.save();
    return user.toJSON();
  }

  /**
   * Map document type IDs to readable names
   */
  private getDocumentTypeName(typeId: string): string {
    const typeMap = {
      '1': 'Passport Copy',
      '2': 'Passport Photo',
      '3': 'Travel Insurance',
      '4': 'Bank Statement',
      '5': 'Employment Letter',
      '6': 'Hotel Booking',
      '7': 'Flight Booking',
      '8': 'Cover Letter',
      '9': 'Additional Document',
      '10': 'Visa Application Form',
      '11': 'Financial Proof',
      '12': 'Invitation Letter'
    };
    return typeMap[typeId] || `Document Type ${typeId}`;
  }

  /**
   * Map document type IDs to slug names
   */
  private getDocumentTypeSlug(typeId: string): string {
    const typeMap = {
      '1': 'passport-copy',
      '2': 'passport-photo',
      '3': 'travel-insurance',
      '4': 'bank-statement',
      '5': 'employment-letter',
      '6': 'hotel-booking',
      '7': 'flight-booking',
      '8': 'cover-letter',
      '9': 'additional-document',
      '10': 'visa-application-form',
      '11': 'financial-proof',
      '12': 'invitation-letter'
    };
    return typeMap[typeId] || 'document';
  }

  /**
   * Email Template Management Methods
   */

  /**
   * Get all email templates
   */
  async getEmailTemplates(): Promise<any> {
    try {
      const templates = await this.emailTemplateModel.findAll({
        order: [['name', 'ASC']],
      });
      return templates;
    } catch (error) {
      console.error('Error fetching email templates:', error);
      throw new Error('Failed to fetch email templates');
    }
  }

  /**
   * Get a specific email template by key
   */
  async getEmailTemplateByKey(key: string): Promise<any> {
    try {
      const template = await this.emailTemplateModel.findOne({
        where: { key },
      });
      return template;
    } catch (error) {
      console.error('Error fetching email template:', error);
      throw new Error('Failed to fetch email template');
    }
  }

  /**
   * Create a new email template
   */
  async createEmailTemplate(data: {
    key: string;
    name: string;
    subject: string;
    body: string;
    description?: string;
    updatedBy?: string;
  }): Promise<any> {
    try {
      const template = await this.emailTemplateModel.create({
        key: data.key,
        name: data.name,
        subject: data.subject,
        body: data.body,
        description: data.description,
        updatedBy: data.updatedBy,
        isActive: true,
      });
      return template;
    } catch (error) {
      console.error('Error creating email template:', error);
      throw new Error('Failed to create email template');
    }
  }

  /**
   * Update an existing email template
   */
  async updateEmailTemplate(
    id: string,
    data: {
      name?: string;
      subject?: string;
      body?: string;
      description?: string;
      isActive?: boolean;
      updatedBy?: string;
    }
  ): Promise<any> {
    try {
      const template = await this.emailTemplateModel.findByPk(id);
      if (!template) {
        throw new Error('Email template not found');
      }

      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.subject !== undefined) updateData.subject = data.subject;
      if (data.body !== undefined) updateData.body = data.body;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;

      await template.update(updateData);
      return template;
    } catch (error) {
      console.error('Error updating email template:', error);
      throw new Error('Failed to update email template');
    }
  }

  /**
   * Delete an email template
   */
  async deleteEmailTemplate(id: string): Promise<any> {
    try {
      const template = await this.emailTemplateModel.findByPk(id);
      if (!template) {
        throw new Error('Email template not found');
      }
      await template.destroy();
      return { success: true, message: 'Email template deleted successfully' };
    } catch (error) {
      console.error('Error deleting email template:', error);
      throw new Error('Failed to delete email template');
    }
  }

  /**
   * Sync email templates with backend definitions
   * This will create missing templates and optionally update existing ones
   */
  async syncEmailTemplates(updateExisting: boolean = false): Promise<any> {
    try {
      const templatesToSync = [
        {
          key: 'otp_email',
          name: 'OTP Email',
          subject: 'Your OTP Code',
          body: '<p>Hi,</p><p>Your One-Time Password (OTP) code is:</p><p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #000000; background: #f5f5f5; padding: 20px; display: inline-block; border-radius: 8px; margin: 20px 0;">${otp}</p><p>This code will expire in <strong>10 minutes</strong>.</p><p>If you did not request this code, please ignore this email.</p>',
          description: 'Email template for OTP verification',
          isActive: true,
        },
        {
          key: 'status_update',
          name: 'Application Status Update',
          subject: 'Application ${applicationNo} Status Update',
          body: '<p>Hi Applicant,</p><p>Your visa application status has been updated:</p><p><strong>New Status:</strong> ${status}</p><p><strong>Message:</strong> ${message}</p>${notes ? `<p><strong>Note:</strong> ${notes}</p>` : ""}',
          description: 'Email template for application status updates',
          isActive: true,
        },
        {
          key: 'application_submitted',
          name: 'Application Submitted',
          subject: 'Visa Application Submitted Successfully',
          body: '<p>Hi ${userName},</p><p>Your visa application has been submitted successfully.</p><p><strong>Application Number:</strong> ${applicationNo}</p><p>We will review your application and update you on the status.</p>',
          description: 'Email template for successful application submission',
          isActive: true,
        },
        {
          key: 'application_approved',
          name: 'Application Approved',
          subject: 'Congratulations! Your Visa Application Has Been Approved',
          body: '<p>Hi ${userName},</p><p>Congratulations! Your visa application has been approved.</p><p><strong>Application Number:</strong> ${applicationNo}</p><p>Please check your account for further instructions.</p>',
          description: 'Email template for approved applications',
          isActive: true,
        },
        {
          key: 'application_rejected',
          name: 'Application Rejected',
          subject: 'Visa Application Update',
          body: '<p>Hi ${userName},</p><p>Your visa application status has been updated.</p><p><strong>Application Number:</strong> ${applicationNo}</p><p><strong>Status:</strong> ${status}</p>${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}<p>Please contact us if you have any questions.</p>',
          description: 'Email template for rejected applications',
          isActive: true,
        },
      ];

      const existingTemplates = await this.emailTemplateModel.findAll();
      const existingKeys = new Map(existingTemplates.map(t => [t.get('key') as string, t]));

      let created = 0;
      let updated = 0;

      for (const templateDef of templatesToSync) {
        const existing = existingKeys.get(templateDef.key);
        
        if (!existing) {
          // Create missing template
          await this.emailTemplateModel.create(templateDef);
          created++;
        } else if (updateExisting) {
          // Update existing template if updateExisting is true
          await existing.update({
            name: templateDef.name,
            subject: templateDef.subject,
            body: templateDef.body,
            description: templateDef.description,
            isActive: templateDef.isActive,
          });
          updated++;
        }
      }

      return {
        success: true,
        message: `Email templates synced successfully. Created: ${created}, Updated: ${updated}`,
        created,
        updated,
      };
    } catch (error) {
      console.error('Error syncing email templates:', error);
      throw new Error('Failed to sync email templates');
    }
  }

  /**
   * Get email footer settings
   */
  async getEmailFooterSettings(): Promise<any> {
    try {
      const settings: any = {
        logoUrl: '/image/logo.png',
        teamSignature: '— Team NUvisa',
        companyInfo: ['If you have any questions, please visit our Help Centre.'],
        twitter: '#',
        facebook: '#',
        instagram: '#',
        linkedin: '#',
      };

      try {
        const results = await this.sequelize.query(`
          SELECT key, value FROM site_content 
          WHERE key IN (
            'email_logo_url', 
            'email_team_signature', 
            'email_company_info',
            'social_twitter', 
            'social_facebook', 
            'social_instagram', 
            'social_linkedin'
          )
        `, {
          type: QueryTypes.SELECT,
        }) as Array<{ key: string; value: string }>;

        // Process results - QueryTypes.SELECT returns array of objects directly
        if (Array.isArray(results) && results.length > 0) {
          console.log(`Fetched ${results.length} footer settings from database`);
          results.forEach((row) => {
            if (!row || !row.key || row.value === null || row.value === undefined) return;
            
            const key = row.key;
            const value = row.value;
            
            if (key === 'email_logo_url') settings.logoUrl = value || settings.logoUrl;
            if (key === 'email_team_signature') settings.teamSignature = value || settings.teamSignature;
            if (key === 'email_company_info') {
              try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                  settings.companyInfo = parsed;
                } else {
                  settings.companyInfo = [parsed];
                }
              } catch {
                settings.companyInfo = value ? [value] : settings.companyInfo;
              }
            }
            if (key === 'social_twitter') settings.twitter = value || settings.twitter;
            if (key === 'social_facebook') settings.facebook = value || settings.facebook;
            if (key === 'social_instagram') settings.instagram = value || settings.instagram;
            if (key === 'social_linkedin') settings.linkedin = value || settings.linkedin;
          });
        } else {
          console.log('No footer settings found in database, using defaults');
        }
      } catch (queryError: any) {
        console.error('Error fetching footer settings from database:', queryError?.message);
        // site_content table might not exist - use defaults
      }

      return settings;
    } catch (error) {
      throw new Error('Failed to fetch email footer settings');
    }
  }

  /**
   * Update email footer settings
   */
  async updateEmailFooterSettings(data: {
    logoUrl?: string;
    teamSignature?: string;
    companyInfo?: string[];
    twitter?: string;
    facebook?: string;
    instagram?: string;
    linkedin?: string;
  }): Promise<any> {
    const updates: Array<{ key: string; value: string }> = [];
    
    try {

      if (data.logoUrl !== undefined) {
        updates.push({ key: 'email_logo_url', value: String(data.logoUrl || '') });
      }
      if (data.teamSignature !== undefined) {
        updates.push({ key: 'email_team_signature', value: String(data.teamSignature || '') });
      }
      if (data.companyInfo !== undefined) {
        const companyInfoValue = Array.isArray(data.companyInfo) 
          ? JSON.stringify(data.companyInfo) 
          : JSON.stringify([String(data.companyInfo || '')]);
        updates.push({ key: 'email_company_info', value: companyInfoValue });
      }
      if (data.twitter !== undefined) {
        updates.push({ key: 'social_twitter', value: String(data.twitter || '#') });
      }
      if (data.facebook !== undefined) {
        updates.push({ key: 'social_facebook', value: String(data.facebook || '#') });
      }
      if (data.instagram !== undefined) {
        updates.push({ key: 'social_instagram', value: String(data.instagram || '#') });
      }
      if (data.linkedin !== undefined) {
        updates.push({ key: 'social_linkedin', value: String(data.linkedin || '#') });
      }

      // Ensure we have updates to process
      if (updates.length === 0) {
        return { success: true, message: 'No updates to process' };
      }

      // Use a transaction to ensure all updates succeed or fail together
      await this.sequelize.transaction(async (transaction) => {
        for (const update of updates) {
          try {
            // Use PostgreSQL's INSERT ... ON CONFLICT (UPSERT) for reliable updates
            // This ensures the record is either inserted or updated atomically
            await this.sequelize.query(`
              INSERT INTO site_content (key, value, type, created_at, updated_at)
              VALUES (:key, :value, 'text', NOW(), NOW())
              ON CONFLICT (key) 
              DO UPDATE SET 
                value = EXCLUDED.value,
                updated_at = NOW()
            `, {
              replacements: { key: update.key, value: update.value },
              type: QueryTypes.INSERT,
              transaction,
            });

            // Verify the update/insert was successful within the transaction
            const verify = await this.sequelize.query(`
              SELECT value FROM site_content WHERE key = :key LIMIT 1
            `, {
              replacements: { key: update.key },
              type: QueryTypes.SELECT,
              transaction,
            }) as Array<{ value: string }>;
            
            if (verify && verify.length > 0) {
              console.log(`✓ ${update.key} saved in transaction: ${verify[0].value.substring(0, 50)}...`);
            } else {
              console.warn(`⚠ Warning: Could not verify ${update.key} was saved in transaction`);
            }
          } catch (upsertError: any) {
            // If UPSERT fails (e.g., no unique constraint), fall back to SELECT then UPDATE/INSERT
            if (upsertError.message?.includes('ON CONFLICT') || upsertError.message?.includes('conflict') || upsertError.message?.includes('unique constraint')) {
              console.log(`Falling back to SELECT/UPDATE for ${update.key}`);
              
              // Check if record exists
              const existing = await this.sequelize.query(`
                SELECT id FROM site_content WHERE key = :key LIMIT 1
              `, {
                replacements: { key: update.key },
                type: QueryTypes.SELECT,
                transaction,
              }) as Array<{ id: string }>;

              if (existing && existing.length > 0) {
                // Update existing record
                await this.sequelize.query(`
                  UPDATE site_content 
                  SET value = :value, updated_at = NOW() 
                  WHERE key = :key
                `, {
                  replacements: { key: update.key, value: update.value },
                  type: QueryTypes.UPDATE,
                  transaction,
                });
                console.log(`✓ Updated ${update.key}`);
              } else {
                // Insert new record
                await this.sequelize.query(`
                  INSERT INTO site_content (key, value, type, created_at, updated_at)
                  VALUES (:key, :value, 'text', NOW(), NOW())
                `, {
                  replacements: { key: update.key, value: update.value },
                  type: QueryTypes.INSERT,
                  transaction,
                });
                console.log(`✓ Inserted ${update.key}`);
              }
            } else {
              throw upsertError;
            }
          }
        }
      });

      // Verify data was persisted after transaction commits
      console.log('Verifying data persistence after transaction commit...');
      for (const update of updates) {
        const postCommitVerify = await this.sequelize.query(`
          SELECT value FROM site_content WHERE key = :key LIMIT 1
        `, {
          replacements: { key: update.key },
          type: QueryTypes.SELECT,
        }) as Array<{ value: string }>;
        
        if (postCommitVerify && postCommitVerify.length > 0) {
          console.log(`✓ Post-commit verification: ${update.key} = ${postCommitVerify[0].value.substring(0, 50)}...`);
        } else {
          console.error(`✗ Post-commit verification FAILED: ${update.key} not found in database`);
        }
      }

      return { success: true, message: 'Email footer settings updated successfully' };
    } catch (error: any) {
      console.error('Error updating email footer settings:', error);
      console.error('Error stack:', error?.stack);
      console.error('Error name:', error?.name);
      console.error('Error code:', error?.code);
      console.error('Updates attempted:', updates.length > 0 ? updates : 'No updates prepared');
      
      // Provide more detailed error message
      const errorMessage = error?.message || error?.toString() || 'Failed to update email footer settings';
      const detailedMessage = error?.code 
        ? `${errorMessage} (Error code: ${error.code})`
        : errorMessage;
      
      throw new Error(detailedMessage);
    }
  }

  /**
   * Get email footer content (logo, social links, etc.)
   */
  private async getEmailFooterContent(): Promise<any> {
    try {
      // Try to query site_content table for logo URL and social links
      let logoUrl = '';
      let twitter = '#';
      let facebook = '#';
      let instagram = '#';
      let linkedin = '#';
      let teamSignature = '— Team NUvisa';
      let companyInfo: string[] = [];
      
      try {
        // Try to get from backend database first
        const logoContent = await this.sequelize.query(`
          SELECT value FROM site_content WHERE key = 'email_logo_url' LIMIT 1
        `) as any[];
        logoUrl = logoContent?.[0]?.[0]?.value || '';
        
        // If not found, check common paths
        if (!logoUrl) {
          // Try common logo paths as fallback (public logo on live frontend)
          logoUrl = '/image/logo.png';
        }
        
        const socialLinks = await this.sequelize.query(`
          SELECT key, value FROM site_content WHERE key IN ('social_twitter', 'social_facebook', 'social_instagram', 'social_linkedin')
        `) as any[];
        
        socialLinks.forEach((link: any) => {
          const row = Array.isArray(link) ? link[0] : link;
          const key = row?.key?.replace('social_', '') || '';
          const value = row?.value || '';
          if (key === 'twitter') twitter = value || '#';
          if (key === 'facebook') facebook = value || '#';
          if (key === 'instagram') instagram = value || '#';
          if (key === 'linkedin') linkedin = value || '#';
        });

        // Get team signature and company info
        const teamSignatureResult = await this.sequelize.query(`
          SELECT value FROM site_content WHERE key = 'email_team_signature' LIMIT 1
        `) as any[];
        teamSignature = teamSignatureResult?.[0]?.[0]?.value || '— Team NUvisa';

        const companyInfoResult = await this.sequelize.query(`
          SELECT value FROM site_content WHERE key = 'email_company_info' LIMIT 1
        `) as any[];
        try {
          const companyInfoValue = companyInfoResult?.[0]?.[0]?.value;
          if (companyInfoValue) {
            companyInfo = JSON.parse(companyInfoValue);
          }
        } catch {
          const companyInfoValue = companyInfoResult?.[0]?.[0]?.value;
          if (companyInfoValue) {
            companyInfo = [companyInfoValue];
          }
        }
      } catch (queryError) {
        // site_content table might not exist in backend database
        logoUrl = '';
      }

      // Global fallback if DB lookup failed entirely
      if (!logoUrl) {
        logoUrl = '/image/logo.png';
      }

      const baseUrl = Env.WEBSITE_URL || 'https://nuvisa.co.uk';
      const helpCentreUrl = `${baseUrl}/get-the-visa#faq`;
      
      // Use company info from database or fallback
      if (companyInfo.length === 0) {
        companyInfo = [
          'NUvisa is an independent company that offers efficient and professional assistance in obtaining visas and other travel products online fast. The company and site are not associated with any governmental agency. VAT registration no: 412344437 | D-U-N-S Number: 227538057 7. | ICO registration number: ZB732764. Registered Office: 2 Brunel Way, The Future Works, Slough, Greater London, England, SL1 1FQ | <a href="mailto:support@nuvisa.co.uk" style="color: #000000; text-decoration: underline;">support@nuvisa.co.uk</a> | +44 7388120901'
        ];
      }
      
      const footerContent = {
        logo: logoUrl,
        twitter,
        facebook,
        instagram,
        linkedin,
        teamSignature: teamSignature || '— Team NUvisa',
        companyInfo
      };

      return footerContent;
    } catch (error) {
      return {
        logo: '',
        twitter: '#',
        facebook: '#',
        instagram: '#',
        linkedin: '#',
        companyInfo: []
      };
    }
  }

  /**
   * Get all sent emails with pagination and filters
   */
  async getEmailLogs(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    templateKey?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<any> {
    try {
      const page = Number(params?.page ?? 1) || 1;
      const limit = Number(params?.limit ?? 50) || 50;
      const offset = (page - 1) * limit;
      const sortBy = params?.sortBy || 'createdAt';
      const sortOrder = params?.sortOrder || 'DESC';
      const search = (params?.search || '').trim();

      const whereConditions: any = {};

      // Text search
      if (search) {
        whereConditions[Op.or] = [
          { recipientEmail: { [Op.iLike]: `%${search}%` } },
          { subject: { [Op.iLike]: `%${search}%` } },
          { recipientName: { [Op.iLike]: `%${search}%` } },
        ];
      }

      // Status filter
      if (params?.status) {
        whereConditions.status = params.status;
      }

      // Template key filter
      if (params?.templateKey) {
        whereConditions.templateKey = params.templateKey;
      }

      // Date range filter
      if (params?.dateFrom || params?.dateTo) {
        const dateFilter: any = {};
        if (params.dateFrom) {
          dateFilter[Op.gte] = new Date(params.dateFrom);
        }
        if (params.dateTo) {
          dateFilter[Op.lte] = new Date(params.dateTo + 'T23:59:59.999Z');
        }
        whereConditions.createdAt = dateFilter;
      }

      const { count, rows } = await this.emailLogModel.findAndCountAll({
        where: whereConditions,
        order: [[sortBy, sortOrder]],
        limit,
        offset,
      });

      return {
        emails: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      console.error('Error fetching email logs:', error);
      throw new Error('Failed to fetch email logs');
    }
  }

  /**
   * Get a specific email log by ID
   */
  async getEmailLogById(id: string): Promise<any> {
    try {
      const emailLog = await this.emailLogModel.findByPk(id);
      if (!emailLog) {
        throw new Error('Email log not found');
      }
      return emailLog;
    } catch (error) {
      console.error('Error fetching email log:', error);
      throw new Error('Failed to fetch email log');
    }
  }
}