import { Module } from "@nestjs/common";
import { StripeController } from "./stripe_payment.controller";
import { StripeService } from "./stripe_payment.service";
import { SequelizeModule } from "@nestjs/sequelize";
import { JwtAuthService } from "../shared/services/jwt-auth.service";
import { JwtService } from "@nestjs/jwt";
import { Payment } from "./payment.entity";
import { AuthService } from "src/auth/auth.service";
import { VisaService } from "src/visaApis/visaApi.service";
import { VisaAPiAuthService } from "src/shared/services/getAuthToken.service";
import { VisaApplicationService } from "src/applicationSteps/visa-application.service";

@Module({
  imports: [SequelizeModule.forFeature([Payment])],
  controllers: [StripeController],
  providers: [
    StripeService,
    VisaService,
    JwtAuthService,
    JwtService,
    AuthService,
    VisaAPiAuthService,
    VisaApplicationService,
  ],
})
export class StripeModule {}
