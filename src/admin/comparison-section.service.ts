import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ComparisonSection } from './comparison-section.entity';
import { CreateComparisonSectionDto, UpdateComparisonSectionDto } from './dto/comparison-section.dto';

@Injectable()
export class ComparisonSectionService {
  constructor(
    @InjectModel(ComparisonSection)
    private comparisonSectionModel: typeof ComparisonSection,
  ) {}

  async findAll(): Promise<ComparisonSection[]> {
    return this.comparisonSectionModel.findAll({
      order: [['createdAt', 'DESC']],
    });
  }

  async findOne(id: string): Promise<ComparisonSection | null> {
    return this.comparisonSectionModel.findByPk(id);
  }

  async findActive(): Promise<ComparisonSection | null> {
    return this.comparisonSectionModel.findOne({
      where: { isActive: true },
      order: [['updatedAt', 'DESC']],
    });
  }

  async create(createDto: CreateComparisonSectionDto, updatedBy?: string): Promise<ComparisonSection> {
    return this.comparisonSectionModel.create({
      ...createDto,
      updatedBy,
    });
  }

  async update(id: string, updateDto: UpdateComparisonSectionDto, updatedBy?: string): Promise<ComparisonSection | null> {
    const [affectedCount] = await this.comparisonSectionModel.update(
      {
        ...updateDto,
        updatedBy,
      },
      {
        where: { id },
      },
    );

    if (affectedCount === 0) {
      return null;
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<boolean> {
    const affectedCount = await this.comparisonSectionModel.destroy({
      where: { id },
    });

    return affectedCount > 0;
  }

  async toggleActive(id: string, updatedBy?: string): Promise<ComparisonSection | null> {
    const comparison = await this.findOne(id);
    if (!comparison) {
      return null;
    }

    return this.update(id, { isActive: !comparison.isActive }, updatedBy);
  }
}
