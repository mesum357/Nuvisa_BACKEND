import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { VisaPricing } from "./visa-pricing.entity";
import { VisaPricingService } from "./visa-pricing.service";
import { VisaPricingController } from "./visa-pricing.controller";

@Module({
  imports: [SequelizeModule.forFeature([VisaPricing])],
  providers: [VisaPricingService],
  controllers: [VisaPricingController],
  exports: [VisaPricingService],
})
export class VisaPricingModule {}

