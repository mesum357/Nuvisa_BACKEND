import { Controller, Get } from '@nestjs/common';
import { AdminService } from './admin.service';
import { GetObjectTemplateForAPIResponseGeneral } from '../shared/data_templates/ObjectTemplateForAPIResponse';
import { EnumAPIResponseStatusType } from '../shared/enums';
import { callHTTPException } from '../shared/exceptions';

/** Public CMS reads for homepage (no auth). */
@Controller('cms')
export class CmsPublicController {
  constructor(private readonly adminService: AdminService) {}

  @Get('homepage')
  async getHomepageContent() {
    try {
      const data = await this.adminService.getHomepageCmsContent();
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Homepage CMS content fetched successfully'
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }
}
