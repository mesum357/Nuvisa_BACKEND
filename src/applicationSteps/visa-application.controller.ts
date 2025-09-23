import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
  Get,
  UseGuards,
  Req,
} from "@nestjs/common";
import { VisaApplicationService } from "./visa-application.service";
// import { VisaApplicationDto } from "./dto/visa-application.dto";
import { GetObjectTemplateForAPIResponseGeneral } from "src/shared/data_templates/ObjectTemplateForAPIResponse";
import { EnumAPIResponseStatusType } from "src/shared/enums";
import { callHTTPException } from "src/shared/exceptions";
import {
  GetApplicationByIdDto,
  VisaApplicationDeleteDto,
  VisaApplicationDto,
  VisaApplicationStepType,
} from "./dto/visa-application.dto";
import { AuthGuard } from "src/shared/middlewares/authGuad.middleware";

@Controller("visa-application")
export class VisaApplicationController {
  constructor(
    private readonly visaApplicationService: VisaApplicationService
  ) {}

  @Get("/")
  @UsePipes(ValidationPipe)
  @UseGuards(AuthGuard)
  async getUserVisaAppliactions(@Req() request: string) {
    try {
      const application =
        await this.visaApplicationService.getUserVisaApplications(
          request["user"]["id"]
        );
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        application,
        "Visa application fetched successfully"
      );
    } catch (error) {
      console.log("error ::: ", error);
      callHTTPException(error.message);
    }
  }

  @Post("getApplicationById")
  @UsePipes(ValidationPipe)
  @UseGuards(AuthGuard)
  async getUserVisaApplicationById(
    @Body() getApplicationByIdDto: GetApplicationByIdDto,
    @Req() request: string
  ) {
    try {
      const application =
        await this.visaApplicationService.getUserVisaApplicationById(
          getApplicationByIdDto
        );
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        application,
        "Visa application fetched successfully"
      );
    } catch (error) {
      console.log("error ::: ", error);
      callHTTPException(error.message);
    }
  }

  @Post("create")
  @UsePipes(ValidationPipe)
  async createVisaApplication(@Body() dto: VisaApplicationDto) {
    try {
      const application =
        await this.visaApplicationService.createOrUpdateApplication(dto);
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        application,
        "Visa application step saved successfully"
      );
    } catch (error) {
      console.log("error ::: ", error);
      callHTTPException(error.message);
    }
  }

  @Post("delete")
  @UsePipes(ValidationPipe)
  async deleteVisaApplication(@Body() dto: VisaApplicationDeleteDto) {
    try {
      const application =
        await this.visaApplicationService.deleteVisaApplication(dto);
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        application,
        "Visa application step saved successfully"
      );
    } catch (error) {
      console.log("error ::: ", error);
      callHTTPException(error.message);
    }
  }

  @Post("archive")
  @UsePipes(ValidationPipe)
  @UseGuards(AuthGuard)
  async archiveVisaApplication(
    @Body() dto: VisaApplicationDeleteDto,
    @Req() request: string
  ) {
    try {
      const application =
        await this.visaApplicationService.archiveVisaApplication(dto);
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        application,
        "Visa application archived successfully"
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }

  @Post("unarchive")
  @UsePipes(ValidationPipe)
  @UseGuards(AuthGuard)
  async unarchiveVisaApplication(
    @Body() dto: VisaApplicationDeleteDto,
    @Req() request: string
  ) {
    try {
      const application =
        await this.visaApplicationService.unarchiveVisaApplication(dto);
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        application,
        "Visa application restored successfully"
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }
}
