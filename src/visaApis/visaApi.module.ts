import { Module } from "@nestjs/common";

import { SequelizeModule } from "@nestjs/sequelize";
import { JwtAuthService } from "../shared/services/jwt-auth.service";
import { JwtService } from "@nestjs/jwt";
import { VisaController } from "./visaApi.controller";
import { VisaService } from "./visaApi.service";
import { VisaAPiAuthService } from "src/shared/services/getAuthToken.service";
import { DebugController } from "./debug.controller";

@Module({
  imports: [],
  controllers: [VisaController, DebugController],
  providers: [VisaService, JwtAuthService, JwtService, VisaAPiAuthService],
})
export class VisaModule {}
