import { Module } from "@nestjs/common";

import { SequelizeModule } from "@nestjs/sequelize";
import { JwtAuthService } from "../shared/services/jwt-auth.service";
import { JwtService } from "@nestjs/jwt";
import { VisaApplication } from "./visa-application.entity";
import { VisaApplicationController } from "./visa-application.controller";
import { VisaApplicationService } from "./visa-application.service";

@Module({
  imports: [SequelizeModule.forFeature([VisaApplication])],
  controllers: [VisaApplicationController],
  providers: [VisaApplicationService, JwtAuthService, JwtService],
})
export class VisaApplicationModule {}
