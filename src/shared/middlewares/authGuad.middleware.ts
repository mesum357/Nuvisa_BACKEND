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

    // Allowlisted origins or admin proxy can bypass auth (e.g., Admin at localhost:3001)
    try {
      const originHeader = (request.headers["x-admin-origin"] as string) || (request.headers["origin"] as string) || (request.headers["referer"] as string) || undefined;
      const adminProxy = request.headers["x-admin-proxy"] === "1";
      const allowList = (process.env.ALLOW_ORIGIN_NOAUTH || "http://localhost:3001").split(",").map((o) => o.trim());
      if ((adminProxy && originHeader && allowList.some((o) => originHeader.startsWith(o))) || (originHeader && allowList.some((o) => originHeader.startsWith(o)))) {
        return true;
      }
    } catch {}

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
