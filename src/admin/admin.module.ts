import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { VisaApplication } from '../applicationSteps/visa-application.entity';
import { User } from '../auth/auth.entity';
import { AuthGuard } from '../shared/middlewares/authGuad.middleware';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    SequelizeModule.forFeature([VisaApplication, User])
  ],
  controllers: [AdminController],
  providers: [AdminService, AuthGuard, JwtService],
  exports: [AdminService]
})
export class AdminModule {}