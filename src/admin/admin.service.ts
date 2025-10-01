import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { VisaApplication } from '../applicationSteps/visa-application.entity';
import { Op, QueryTypes, where, col, cast } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import {
  SearchApplicationsDto,
  UpdateApplicationStatusDto,
  GetApplicationDetailsDto,
  ApplicationStatus,
  SearchType
} from './dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(VisaApplication)
    private visaApplicationModel: typeof VisaApplication,
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
      const application = await this.visaApplicationModel.findByPk(updateDto.applicationId);

      if (!application) {
        throw new Error('Application not found');
      }

      await application.update({
        applicationStatus: updateDto.status,
        updatedAt: new Date()
      });

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

    return {
      ...appData,
      applicationId,
      travelersData,
      orderId,
      code: orderId || appData.orderId || `APP-${applicationId.slice(0, 8).toUpperCase()}`
    };
  }

  private async calculateApplicationStats(filters?: any): Promise<any> {
    try {
      const whereCondition = filters || {};

      const total = await this.visaApplicationModel.count({ where: whereCondition });
      const pending = await this.visaApplicationModel.count({
        where: { ...whereCondition, applicationStatus: { [Op.in]: ['new', 'draft'] } },
      });
      const in_progress = await this.visaApplicationModel.count({
        where: { ...whereCondition, applicationStatus: { [Op.in]: ['submitted', 'under_review', 'processing'] } },
      });
      const completed = await this.visaApplicationModel.count({
        where: { ...whereCondition, applicationStatus: { [Op.in]: ['completed', 'approved'] } },
      });
      const rejected = await this.visaApplicationModel.count({
        where: { ...whereCondition, applicationStatus: { [Op.in]: ['rejected', 'cancelled'] } },
      });

      return { total, pending, in_progress, completed, rejected };
    } catch (error) {
      console.error('Error calculating stats:', error);
      return { total: 0, pending: 0, in_progress: 0, completed: 0, rejected: 0 };
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
}