import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { VisaPricingService } from "./visa-pricing.service";
import {
  CreateVisaPricingDto,
  DeleteVisaPricingDto,
  GetVisaPricingByIdDto,
  UpdateVisaPricingBodyDto,
  UpdateVisaPricingDto,
} from "./dto/visa-pricing.dto";
import { callHTTPException } from "src/shared/exceptions";
import { GetObjectTemplateForAPIResponseGeneral } from "src/shared/data_templates/ObjectTemplateForAPIResponse";
import { EnumAPIResponseStatusType } from "src/shared/enums";

@Controller("visa_pricing")
export class VisaPricingController {
  constructor(private readonly visaPricingService: VisaPricingService) {}

  @Get()
  async getAll() {
    try {
      const data = await this.visaPricingService.getAll();
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        "Visa pricing list fetched successfully"
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }

  @Get(":id")
  @UsePipes(ValidationPipe)
  async getById(@Param() params: GetVisaPricingByIdDto) {
    try {
      const data = await this.visaPricingService.getById(params);
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        "Visa pricing fetched successfully"
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }

  @Post()
  @UsePipes(ValidationPipe)
  async create(@Body() dto: CreateVisaPricingDto) {
    try {
      const data = await this.visaPricingService.create(dto);
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        "Visa pricing created successfully"
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }

  @Patch(":id")
  @UsePipes(ValidationPipe)
  async update(@Param("id") id: string, @Body() dto: UpdateVisaPricingBodyDto) {
    try {
      const payload: UpdateVisaPricingDto = { id, ...dto };
      const data = await this.visaPricingService.update(payload);
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        "Visa pricing updated successfully"
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }

  @Delete(":id")
  @UsePipes(ValidationPipe)
  async remove(@Param() params: DeleteVisaPricingDto) {
    try {
      const data = await this.visaPricingService.remove(params);
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        "Visa pricing deleted successfully"
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }
}
