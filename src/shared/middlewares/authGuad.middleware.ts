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
    
    console.log('AuthGuard: Starting authentication check');
    console.log('AuthGuard: Request headers:', {
      authorization: request.headers.authorization,
      'x-admin-origin': request.headers['x-admin-origin'],
      'x-admin-proxy': request.headers['x-admin-proxy'],
      origin: request.headers.origin,
      referer: request.headers.referer
    });

    // Allowlisted origins or admin proxy can bypass auth (e.g., Admin at localhost:3001)
    try {
      const originHeader = (request.headers["x-admin-origin"] as string) || (request.headers["origin"] as string) || (request.headers["referer"] as string) || undefined;
      const adminProxy = request.headers["x-admin-proxy"] === "1";
      const defaultAllowList = [
        "http://localhost:3001",
        "http://localhost:3000",
        "https://nuvisa-admin-updated.vercel.app",
        "https://nuvisa-admin.vercel.app",
      ];
      const allowList = (process.env.ALLOW_ORIGIN_NOAUTH ? process.env.ALLOW_ORIGIN_NOAUTH.split(",") : defaultAllowList)
        .map((o) => o.trim())
        .filter(Boolean);

      // Ensure admin hosts are always allowed for proxy access.
      [
        "https://nuvisa-admin-updated.vercel.app",
        "https://nuvisa-admin.vercel.app",
      ].forEach((origin) => {
        if (!allowList.includes(origin)) {
          allowList.push(origin);
        }
      });
      
      console.log('AuthGuard: Origin check:', { originHeader, adminProxy, allowList });
      
      if ((adminProxy && originHeader && allowList.some((o) => originHeader.startsWith(o))) || (originHeader && allowList.some((o) => originHeader.startsWith(o)))) {
        console.log('AuthGuard: Bypassing auth due to allowlisted origin');
        return true;
      }
    } catch (error) {
      console.log('AuthGuard: Error in origin check:', error);
    }

    const token = this.extractTokenFromHeader(request);
    console.log('AuthGuard: Extracted token:', token ? 'Present' : 'Missing');
    
    if (!token) {
      console.log('AuthGuard: No token found, throwing exception');
      callHTTPException("UnauthorizedException");
      // throw new UnauthorizedException();
    }
    try {
      console.log('AuthGuard: Verifying token...');
      const user = await this.jwtService.verifyAsync(token, {
        secret: Env.jwt_secret,
      });

      console.log('AuthGuard: Token verified, user payload:', user);

      if (!user) {
        console.log('AuthGuard: User payload is null/undefined');
        callHTTPException("UnauthorizedException");
        // throw new UnauthorizedException();
      }

      const user_id = user["_id"];
      const user_email = user["_email"];
      const user_name = user["_username"];
      const first_name = user["_first_name"];
      const user_type = user["_user_type"];

      console.log('AuthGuard: Extracted user data:', { user_id, user_email, user_name, first_name, user_type });

      request.user = {
        id: user_id,
        email: user_email,
        user_name: user_name,
        first_name: first_name,
        user_type: user_type,
      };

      console.log('AuthGuard: Set request.user:', request.user);

      let isUserExist = await User.findOne({
        where: { id: user_id },
      });
      
      console.log('AuthGuard: User exists in DB:', isUserExist ? 'Yes' : 'No');
      
      if (!isUserExist) {
        console.log('AuthGuard: User not found in database, throwing exception');
        callHTTPException("UnauthorizedException");
        // throw new UnauthorizedException();
      }

      console.log('AuthGuard: Authentication successful');
      return true;
    } catch (err) {
      console.log('AuthGuard: Error during authentication:', err);
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
