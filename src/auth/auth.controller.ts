import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto, VefifyOtpDto } from "./dto";
import { VisaAPiAuthService } from "src/shared/services/getAuthToken.service";

import {
  GetObjectTemplateForAPIResponseGeneral,
  ObjectTemplateForAPIResponseGeneral,
} from "src/shared/data_templates/ObjectTemplateForAPIResponse";
import { EnumAPIResponseStatusType } from "src/shared/enums";
import { callHTTPException } from "src/shared/exceptions";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly visaApiAuthService: VisaAPiAuthService
  ) {}

  @Post("login")
  @UsePipes(ValidationPipe)
  async login(
    @Body() loginDto: LoginDto
  ): Promise<typeof ObjectTemplateForAPIResponseGeneral | null> {
    try {
      const user = await this.authService.login(loginDto);
      if (!user) {
        callHTTPException("Invalid email or password.");
      }

      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        user,
        "Login Successful."
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }

  @Post("verify-otp")
  @UsePipes(ValidationPipe)
  async verifyOtp(
    @Body() verifyOtpDto: VefifyOtpDto
  ): Promise<typeof ObjectTemplateForAPIResponseGeneral | null> {
    try {
      const user = await this.authService.verifyOtp(verifyOtpDto);
      if (!user) {
        callHTTPException("Invalid email or password.");
      }

      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        user,
        "OTP Verification Successfull."
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }

  @Post("generate-token")
  async generateToken(): Promise<typeof ObjectTemplateForAPIResponseGeneral | null> {
    try {
      const tokenResponse = await this.visaApiAuthService.GetVisaApiAuthToken();
      
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        tokenResponse,
        "SMV Konveyor auth token generated successfully."
      );
    } catch (error) {
      callHTTPException(error.message);
    }
  }
}
