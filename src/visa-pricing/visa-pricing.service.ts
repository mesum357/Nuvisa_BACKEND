import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { VisaPricing } from "./visa-pricing.entity";
import {
  CreateVisaPricingDto,
  DeleteVisaPricingDto,
  GetVisaPricingByIdDto,
  UpdateVisaPricingDto,
} from "./dto/visa-pricing.dto";
import { callHTTPException } from "src/shared/exceptions";

@Injectable()
export class VisaPricingService {
  constructor(
    @InjectModel(VisaPricing)
    private readonly visaPricingModel: typeof VisaPricing
  ) {}

  async getAll(): Promise<VisaPricing[]> {
    return this.visaPricingModel.findAll({
      order: [["name", "ASC"]],
    });
  }

  async getById(dto: GetVisaPricingByIdDto): Promise<VisaPricing> {
    const record = await this.visaPricingModel.findByPk(dto.id);
    if (!record) {
      callHTTPException("Visa pricing record not found");
    }
    return record;
  }

  async create(dto: CreateVisaPricingDto): Promise<VisaPricing> {
    const existing = await this.visaPricingModel.findOne({
      where: { name: dto.name },
    });

    if (existing) {
      callHTTPException("Visa pricing with this country name already exists");
    }

    return this.visaPricingModel.create({
      name: dto.name,
      basePrice: dto.basePrice,
      strikeOutPrice: dto.strikeOutPrice,
      reason: dto.reason || "",
      showReason: dto.showReason ?? false,
    });
  }

  async update(dto: UpdateVisaPricingDto): Promise<VisaPricing> {
    const { id, ...updatePayload } = dto;

    const record = await this.visaPricingModel.findByPk(id);
    if (!record) {
      callHTTPException("Visa pricing record not found");
    }

    if (updatePayload.name && updatePayload.name !== record.name) {
      const duplicate = await this.visaPricingModel.findOne({
        where: { name: updatePayload.name },
      });
      if (duplicate) {
        callHTTPException("Visa pricing with this country name already exists");
      }
    }

    await record.update(updatePayload);
    return record;
  }

  async remove(dto: DeleteVisaPricingDto): Promise<{ id: string; deleted: boolean }> {
    const record = await this.visaPricingModel.findByPk(dto.id);
    if (!record) {
      callHTTPException("Visa pricing record not found");
    }

    await record.destroy();
    return { id: dto.id, deleted: true };
  }
}

