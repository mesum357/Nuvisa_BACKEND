import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ComparisonSectionController } from './comparison-section.controller';
import { ComparisonSectionService } from './comparison-section.service';
import { ComparisonSection } from './comparison-section.entity';
import { VisaApplication } from '../applicationSteps/visa-application.entity';
import { User } from '../auth/auth.entity';
import { AuthGuard } from '../shared/middlewares/authGuad.middleware';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    SequelizeModule.forFeature([VisaApplication, User, ComparisonSection])
  ],
  controllers: [AdminController, ComparisonSectionController],
  providers: [AdminService, ComparisonSectionService, AuthGuard, JwtService],
  exports: [AdminService, ComparisonSectionService]
})
export class AdminModule {}