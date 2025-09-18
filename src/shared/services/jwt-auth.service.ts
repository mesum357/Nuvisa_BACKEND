import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Env } from '../config';

@Injectable()
export class JwtAuthService {
  constructor( private readonly jwtService: JwtService) {}

  async generateToken(user): Promise<string> {
    const payload = {
      _id: user.id,
      _email: user.email,
      _username: user.user_name,
      _first_name: user.first_name,
      _user_type: user.user_type,
    };
    const options = {
      expiresIn: '1d',
      secret: Env.jwt_secret,
    };

    return this.jwtService.sign(payload, options);
  }

  async getUserFromToken(
    token: string,
  ): Promise<any> {
    return this.jwtService.decode(token);
  }
}
