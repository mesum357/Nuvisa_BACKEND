import { MiddlewareConsumer, Module, OnModuleInit } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { AppController } from "./app.controller";
import { SequelizeModule } from "@nestjs/sequelize";
import { AuthModule } from "./auth/auth.module";
import { Env } from "./shared/config";
import { JwtAuthService } from "./shared/services/jwt-auth.service";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth/auth.service";
import { SanitizationMiddleware } from "./shared/middlewares/sanitization.middleware";
import { VisaAPiAuthService } from "./shared/services/getAuthToken.service";
import { VisaModule } from "./visaApis/visaApi.module";
import { VisaService } from "./visaApis/visaApi.service";
import { StripeModule } from "./stripe/stripe.module";
import { VisaApplicationModule } from "./applicationSteps/visa-application.module";
import { VisaApplicationService } from "./applicationSteps/visa-application.service";
import { AdminModule } from "./admin/admin.module";
import { UploadModule } from "./upload/upload.module";
import { EmailTemplate } from "./email-templates/email-template.entity";

@Module({
  imports: [
    SequelizeModule.forRoot({
      dialect: "postgres",
      host: Env.DATABASE_HOST,
      port: Number(Env.DATABASE_PORT) || 5432,
      username: Env.DATABASE_USER,
      password: Env.DATABASE_PASSWORD,
      database: Env.DATABASE_NAME,
      autoLoadModels: true,
      synchronize: false,
      models: [EmailTemplate],
      logging: false,
      pool: {
        max: 15,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      dialectOptions: Env.DATABASE_SSL === "true" ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      } : {},
    }),
    SequelizeModule.forFeature([]),
    AuthModule,
    VisaModule,
    StripeModule,
    VisaApplicationModule,
    AdminModule,
    UploadModule,
  ],
  controllers: [AppController],
  providers: [
    JwtAuthService,
    JwtService,
    AuthService,
    SanitizationMiddleware,
    VisaAPiAuthService,
    VisaService,
    VisaApplicationService,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    private sequelize: Sequelize,
    private sanitizer: SanitizationMiddleware
  ) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SanitizationMiddleware).forRoutes("*");
  }

  async onModuleInit() {
    try {
      await this.sequelize.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'id_sequence') THEN
            CREATE SEQUENCE id_sequence START 1;
          END IF;
        END $$;
      `);
    } catch {}

    try {
      await this.sequelize.sync({ alter: true });
      
      // Initialize email templates if table is empty
      await this.initializeEmailTemplates();
    } catch (error) {
      console.error("Database synchronization failed:", error);
    }
  }

  async initializeEmailTemplates() {
    try {
      const EmailTemplate = this.sequelize.models.EmailTemplate;
      if (!EmailTemplate) return;

      const count = await EmailTemplate.count();
      if (count > 0) return;

      await EmailTemplate.bulkCreate([
        {
          key: 'otp_email',
          name: 'OTP Email',
          subject: 'Your OTP Code',
          body: '<p>Hi,</p><p>Your One-Time Password (OTP) code is:</p><p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #000000; background: #f5f5f5; padding: 20px; display: inline-block; border-radius: 8px; margin: 20px 0;">${otp}</p><p>This code will expire in <strong>10 minutes</strong>.</p><p>If you did not request this code, please ignore this email.</p>',
          description: 'Email template for OTP verification',
          isActive: true,
        },
        {
          key: 'status_update',
          name: 'Application Status Update',
          subject: 'Visa Application Status Update - ${status}',
          body: '<p>Hi ${userName},</p><p>Your visa application status has been updated:</p><p><strong>Previous Status:</strong> ${oldStatus || "Unknown"}</p><p><strong>New Status:</strong> ${status}</p><p><strong>Message:</strong> ${message}</p><p><strong>Additional Notes:</strong> ${notes}</p><p>Please log in to your account to view more details.</p>',
          description: 'Email template for application status updates',
          isActive: true,
        },
        {
          key: 'application_submitted',
          name: 'Application Submitted',
          subject: 'Visa Application Submitted Successfully',
          body: '<p>Hi ${userName},</p><p>Your visa application has been submitted successfully.</p><p><strong>Application Number:</strong> ${applicationNo}</p><p>We will review your application and update you on the status.</p>',
          description: 'Email template for successful application submission',
          isActive: true,
        },
        {
          key: 'application_approved',
          name: 'Application Approved',
          subject: 'Congratulations! Your Visa Application Has Been Approved',
          body: '<p>Hi ${userName},</p><p>Congratulations! Your visa application has been approved.</p><p><strong>Application Number:</strong> ${applicationNo}</p><p>Please check your account for further instructions.</p>',
          description: 'Email template for approved applications',
          isActive: true,
        },
        {
          key: 'application_rejected',
          name: 'Application Rejected',
          subject: 'Visa Application Update',
          body: '<p>Hi ${userName},</p><p>Your visa application status has been updated.</p><p><strong>Application Number:</strong> ${applicationNo}</p><p><strong>Status:</strong> ${status}</p><p><strong>Notes:</strong> ${notes}</p><p>Please contact us if you have any questions.</p>',
          description: 'Email template for rejected applications',
          isActive: true,
        },
      ]);

      console.log('Email templates initialized successfully');
    } catch (error) {
      console.error('Failed to initialize email templates:', error);
    }
  }
}
