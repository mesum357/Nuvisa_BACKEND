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
      logging: false,
      pool: {
        max: 15,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
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
      console.log("Database synchronized successfully");
    } catch (error) {
      console.error("Database synchronization failed:", error);
    }
  }
}
