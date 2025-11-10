import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { VisaApplication } from '../applicationSteps/visa-application.entity';
import { User } from '../auth/auth.entity';
import { EmailTemplate } from '../email-templates/email-template.entity';
import { Op, QueryTypes, where, col, cast, fn, col as sqCol, literal } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import {
  SearchApplicationsDto,
  UpdateApplicationStatusDto,
  GetApplicationDetailsDto,
  ApplicationStatus,
  SearchType
} from './dto';
import { sendEmail, renderTemplate, renderTemplateFromDB } from '../shared/services/sendEmail.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(VisaApplication)
    private visaApplicationModel: typeof VisaApplication,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(EmailTemplate)
    private emailTemplateModel: typeof EmailTemplate,
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
        limit = '50'
      } = searchDto;

      const whereConditions: any = {};

      // Text search
      if (query && query.trim()) {
        const searchQuery = query.trim();
        const likeQuery = `%${searchQuery}%`;
        const idIlike = where(cast(col('id'), 'TEXT'), { [Op.iLike]: likeQuery });
        const orderIdIlike = where(cast(col('orderId'), 'TEXT'), { [Op.iLike]: likeQuery });
        
        switch (type) {
          case SearchType.APPLICATION_ID:
            whereConditions[Op.or] = [
              idIlike,
              orderIdIlike,
            ];
            break;
          case SearchType.ORDER_ID:
            whereConditions[Op.and] = [orderIdIlike];
            break;
          default: // ALL
            whereConditions[Op.or] = [
              idIlike,
              orderIdIlike,
              { country: { [Op.iLike]: likeQuery } },
              { email: { [Op.iLike]: likeQuery } },
            ];
        }
      }

      // Status filter
      if (status) {
        whereConditions.applicationStatus = status;
      }

      // Country filter
      if (country) {
        whereConditions.country = { [Op.iLike]: `%${country}%` };
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
        whereConditions.createdAt = dateFilter;
      }

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
      await application.update({
        applicationStatus: updateDto.status,
        updatedAt: new Date()
      });

      // Reload the application to get the updated values
      await application.reload();

      // Send email notification to user
      try {
        const statusMessages = {
          'submitted': 'Your application has been submitted and is being reviewed.',
          'under_review': 'Your application is now under review by our team.',
          'processing': 'Your application is being processed.',
          'appointment_booked': 'Your appointment has been booked. Please check your email for details.',
          'at_embassy': 'Your application is now at the embassy for final processing.',
          'approved': 'Congratulations! Your visa application has been approved.',
          'completed': 'Your visa application has been completed successfully.',
          'rejected': 'Unfortunately, your visa application has been rejected. Please contact us for more information.',
          'cancelled': 'Your visa application has been cancelled.'
        };

        const message = statusMessages[updateDto.status] || `Your application status has been updated to: ${updateDto.status}`;
        
        // Try to use database template
        try {
          const template = await this.emailTemplateModel.findOne({
            where: { key: 'status_update', isActive: true }
          });

          if (template) {
            // Extract user name from travelersData if available
            let userName = 'Applicant';
            try {
              if (application.travelersData && typeof application.travelersData === 'object') {
                const travelers = application.travelersData;
                if (Array.isArray(travelers) && travelers.length > 0) {
                  const firstTraveler = travelers[0];
                  userName = (firstTraveler.firstName && firstTraveler.lastName) 
                    ? `${firstTraveler.firstName} ${firstTraveler.lastName}`
                    : firstTraveler.firstName || firstTraveler.lastName || 'Applicant';
                }
              }
            } catch (err) {
              // Keep default userName if extraction fails
            }

            const { subject: emailSubject, emailBody } = await renderTemplateFromDB(
              'status_update',
              {
                userName: userName,
                status: updateDto.status.toUpperCase(),
                oldStatus: oldStatus || 'Unknown',
                message: message,
                notes: updateDto.notes || '',
              },
              template
            );
            
            const footerContent = await this.getEmailFooterContent();
            
            await sendEmail(
              {
                emailAddress: application.email,
                subject: emailSubject,
                body: emailBody,
              },
              footerContent
            );
          } else {
            // Fallback to hardcoded template
            const footerContent = await this.getEmailFooterContent();
            await sendEmail(
              {
                emailAddress: application.email,
                subject: `Visa Application Status Update - ${updateDto.status.toUpperCase()}`,
                body: `
                  <p>Dear Applicant,</p>
                  <p>Your visa application status has been updated:</p>
                  <p><strong>Previous Status:</strong> ${oldStatus || 'Unknown'}</p>
                  <p><strong>New Status:</strong> ${updateDto.status.toUpperCase()}</p>
                  <p><strong>Message:</strong> ${message}</p>
                  ${updateDto.notes ? `<p><strong>Additional Notes:</strong> ${updateDto.notes}</p>` : ''}
                  <p>Please log in to your account to view more details.</p>
                `
              },
              footerContent
            );
          }
        } catch (templateError) {
          // Fallback to hardcoded email
          const footerContent = await this.getEmailFooterContent();
          await sendEmail(
            {
              emailAddress: application.email,
              subject: `Visa Application Status Update - ${updateDto.status.toUpperCase()}`,
              body: `
                <p>Dear Applicant,</p>
                <p>Your visa application status has been updated:</p>
                <p><strong>Previous Status:</strong> ${oldStatus || 'Unknown'}</p>
                <p><strong>New Status:</strong> ${updateDto.status.toUpperCase()}</p>
                <p><strong>Message:</strong> ${message}</p>
                ${updateDto.notes ? `<p><strong>Additional Notes:</strong> ${updateDto.notes}</p>` : ''}
                <p>Please log in to your account to view more details.</p>
              `
            },
            footerContent
          );
        }
        
        console.log(`Email notification sent to ${application.email} for status change from ${oldStatus} to ${updateDto.status}`);
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
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

  /**
   * Get application activity log (mock implementation)
   */
  async getApplicationActivity(applicationId: string): Promise<any> {
    try {
      const application = await this.visaApplicationModel.findByPk(applicationId);

      if (!application) {
        throw new Error('Application not found');
      }

      // Mock activity log - in real implementation, you'd have an activity/audit table
      const activities = [
        {
          id: 1,
          type: 'status_change',
          description: 'Application submitted',
          timestamp: application.createdAt,
          adminId: null,
          details: { from: null, to: 'submitted' }
        },
        {
          id: 2,
          type: 'status_change',
          description: 'Application under review',
          timestamp: new Date(application.createdAt.getTime() + 24 * 60 * 60 * 1000),
          adminId: 'admin-1',
          details: { from: 'submitted', to: 'under_review' }
        }
      ];

      return {
        applicationId,
        activities: activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      };
    } catch (error) {
      console.error('Error fetching application activity:', error);
      throw new Error('Failed to fetch application activity');
    }
  }

  /**
   * Get application comments (mock implementation)
   */
  async getApplicationComments(applicationId: string): Promise<any> {
    try {
      const application = await this.visaApplicationModel.findByPk(applicationId);

      if (!application) {
        throw new Error('Application not found');
      }

      // Mock comments - in real implementation, you'd have a comments table
      const comments = [
        {
          id: 1,
          comment: 'Application looks good, all documents are in order.',
          isInternal: true,
          adminId: 'admin-1',
          adminEmail: 'admin@nuvisa.com',
          createdAt: new Date(application.createdAt.getTime() + 2 * 60 * 60 * 1000),
          updatedAt: new Date(application.createdAt.getTime() + 2 * 60 * 60 * 1000)
        },
        {
          id: 2,
          comment: 'Please provide additional bank statement for the last 3 months.',
          isInternal: false,
          adminId: 'admin-1',
          adminEmail: 'admin@nuvisa.com',
          createdAt: new Date(application.createdAt.getTime() + 3 * 60 * 60 * 1000),
          updatedAt: new Date(application.createdAt.getTime() + 3 * 60 * 60 * 1000)
        }
      ];

      return {
        applicationId,
        comments: comments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      };
    } catch (error) {
      console.error('Error fetching application comments:', error);
      throw new Error('Failed to fetch application comments');
    }
  }

  /**
   * Add comment to application (mock implementation)
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

      // Mock comment creation - in real implementation, you'd save to a comments table
      const newComment = {
        id: Date.now(), // Mock ID
        comment: data.comment,
        isInternal: data.isInternal,
        adminId: data.adminId,
        adminEmail: data.adminEmail,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // In a real implementation, you would:
      // 1. Save the comment to a comments table
      // 2. Send email notification if isInternal is false
      // 3. Log the activity

      return {
        applicationId: data.applicationId,
        comment: newComment
      };
    } catch (error) {
      console.error('Error adding application comment:', error);
      throw new Error('Failed to add application comment');
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

    return {
      ...appData,
      applicationId,
      travelersData,
      orderId,
      formattedApplicationId: formatApplicationId(applicationId),
      formattedOrderId: formatOrderId(orderId),
      code: formatOrderId(orderId) || formatApplicationId(applicationId)
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
          const key = link.key.replace('social_', '');
          if (key === 'twitter') twitter = link.value || '#';
          if (key === 'facebook') facebook = link.value || '#';
          if (key === 'instagram') instagram = link.value || '#';
          if (key === 'linkedin') linkedin = link.value || '#';
        });
      } catch (queryError) {
        // site_content table might not exist in backend database
        logoUrl = '';
      }

      // Global fallback if DB lookup failed entirely
      if (!logoUrl) {
        logoUrl = '/image/logo.png';
      }

      const footerContent = {
        logo: logoUrl,
        twitter,
        facebook,
        instagram,
        linkedin,
        companyInfo: [
          'If you would like to find out more about NUvisa, please reach out to us via support@nuvisa.co.uk. NUvisa Ltd (No. 08804411) is an independent visa assistance company.'
        ]
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
}