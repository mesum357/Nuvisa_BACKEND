import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UsePipes,
  ValidationPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ComparisonSectionService } from './comparison-section.service';
import { CreateComparisonSectionDto, UpdateComparisonSectionDto } from './dto/comparison-section.dto';
import { GetObjectTemplateForAPIResponseGeneral } from '../shared/data_templates/ObjectTemplateForAPIResponse';
import { EnumAPIResponseStatusType } from '../shared/enums';
import { callHTTPException } from '../shared/exceptions';
import { AuthGuard } from '../shared/middlewares/authGuad.middleware';

@Controller('comparison-section')
@UseGuards(AuthGuard)
export class ComparisonSectionController {
  constructor(private readonly comparisonSectionService: ComparisonSectionService) {}

  /**
   * GET /comparison-section
   * Get all comparison sections
   */
  @Get()
  async findAll(@Req() request: any) {
    try {
      const data = await this.comparisonSectionService.findAll();
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Comparison sections fetched successfully'
      );
    } catch (error) {
      console.error('Error in findAll:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * GET /comparison-section/active
   * Get active comparison section
   */
  @Get('active')
  async findActive(@Req() request: any) {
    try {
      const data = await this.comparisonSectionService.findActive();
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Active comparison section fetched successfully'
      );
    } catch (error) {
      console.error('Error in findActive:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * GET /comparison-section/:id
   * Get comparison section by ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() request: any) {
    try {
      const data = await this.comparisonSectionService.findOne(id);
      if (!data) {
        callHTTPException('Comparison section not found');
      }
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Comparison section fetched successfully'
      );
    } catch (error) {
      console.error('Error in findOne:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * POST /comparison-section
   * Create new comparison section
   */
  @Post()
  @UsePipes(ValidationPipe)
  async create(@Body() createDto: CreateComparisonSectionDto, @Req() request: any) {
    try {
      const updatedBy = request.user?.id || 'system';
      const data = await this.comparisonSectionService.create(createDto, updatedBy);
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Comparison section created successfully'
      );
    } catch (error) {
      console.error('Error in create:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * PATCH /comparison-section/:id
   * Update comparison section
   */
  @Patch(':id')
  @UsePipes(ValidationPipe)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateComparisonSectionDto,
    @Req() request: any
  ) {
    try {
      const updatedBy = request.user?.id || 'system';
      const data = await this.comparisonSectionService.update(id, updateDto, updatedBy);
      if (!data) {
        callHTTPException('Comparison section not found');
      }
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Comparison section updated successfully'
      );
    } catch (error) {
      console.error('Error in update:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * PATCH /comparison-section/:id/toggle
   * Toggle comparison section active status
   */
  @Patch(':id/toggle')
  async toggleActive(@Param('id') id: string, @Req() request: any) {
    try {
      const updatedBy = request.user?.id || 'system';
      const data = await this.comparisonSectionService.toggleActive(id, updatedBy);
      if (!data) {
        callHTTPException('Comparison section not found');
      }
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        data,
        'Comparison section status toggled successfully'
      );
    } catch (error) {
      console.error('Error in toggleActive:', error);
      callHTTPException(error.message);
    }
  }

  /**
   * DELETE /comparison-section/:id
   * Delete comparison section
   */
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() request: any) {
    try {
      const success = await this.comparisonSectionService.remove(id);
      if (!success) {
        callHTTPException('Comparison section not found');
      }
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        null,
        'Comparison section deleted successfully'
      );
    } catch (error) {
      console.error('Error in remove:', error);
      callHTTPException(error.message);
    }
  }
}
