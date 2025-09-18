import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { callHTTPException } from "../exceptions";

import { Env } from "../config";
import { User } from "src/auth/auth.entity";
import { Request } from "express";
import { TokenExpiredError } from "jsonwebtoken";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const token = this.extractTokenFromHeader(request);
    if (!token) {
      callHTTPException("UnauthorizedException");
      // throw new UnauthorizedException();
    }
    try {
      const user = await this.jwtService.verifyAsync(token, {
        secret: Env.jwt_secret,
      });

      if (!user) {
        callHTTPException("UnauthorizedException");
        // throw new UnauthorizedException();
      }

      const user_id = user["_id"];
      const user_email = user["_email"];
      const user_name = user["_username"];
      const first_name = user["_first_name"];
      const user_type = user["_user_type"];

      request.user = {
        id: user_id,
        email: user_email,
        user_name: user_name,
        first_name: first_name,
        user_type: user_type,
      };

      let isUserExist = await await User.findOne({
        where: { id: user_id },
      });
      if (!isUserExist) {
        callHTTPException("UnauthorizedException");
        // throw new UnauthorizedException();
      }

      return true;
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        callHTTPException("UnauthorizedException");
      } else {
        callHTTPException(err.message);
      }
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }
}
