import { MiddlewareConsumer, Module, OnModuleInit } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes } from "sequelize";
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
import { GiftCardModule } from "./gift-card/gift-card.module";
import { EmailTemplate } from "./email-templates/email-template.entity";
import { EmailLog } from "./email-logs/email-log.entity";
import { VisaPricingModule } from "./visa-pricing/visa-pricing.module";

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
      models: [EmailTemplate, EmailLog],
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
    GiftCardModule,
    VisaPricingModule,
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
      // Create site_content table if it doesn't exist
      await this.createSiteContentTable();
      
      // Create gift_cards table if it doesn't exist
      await this.createGiftCardsTable();
      
      await this.sequelize.sync({ alter: true });
      
      // Initialize email templates if table is empty
      await this.initializeEmailTemplates();
    } catch (error) {
      console.error("Database synchronization failed:", error);
    }
  }

  async createSiteContentTable() {
    try {
      // Check if table exists first
      const tableExistsResult = await this.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'site_content'
        ) as exists;
      `, { type: QueryTypes.SELECT }) as Array<{ exists: boolean }>;

      const exists = tableExistsResult && tableExistsResult.length > 0 && tableExistsResult[0]?.exists === true;

      if (!exists) {
        console.log('Creating site_content table...');
        
        // Create table with unique constraint on key
        await this.sequelize.query(`
          CREATE TABLE site_content (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            key VARCHAR(255) NOT NULL,
            value TEXT NOT NULL,
            type VARCHAR(50) DEFAULT 'text',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_by VARCHAR(255),
            CONSTRAINT site_content_key_unique UNIQUE (key)
          );
        `);

        // Create index on updated_at for faster queries
        await this.sequelize.query(`
          CREATE INDEX IF NOT EXISTS site_content_updated_at_idx ON site_content(updated_at);
        `);

        console.log('✓ Site content table created successfully');
      } else {
        console.log('✓ Site content table already exists');
        
        // Ensure the unique constraint exists (in case table was created with old structure)
        try {
          const constraintExists = await this.sequelize.query(`
            SELECT EXISTS (
              SELECT 1 FROM pg_constraint 
              WHERE conname = 'site_content_key_unique'
            ) as exists;
          `, { type: QueryTypes.SELECT }) as Array<{ exists: boolean }>;
          
          if (!constraintExists || !constraintExists[0]?.exists) {
            console.log('Adding unique constraint on key column...');
            await this.sequelize.query(`
              ALTER TABLE site_content 
              ADD CONSTRAINT site_content_key_unique UNIQUE (key);
            `);
            console.log('✓ Unique constraint added successfully');
          }
        } catch (constraintError: any) {
          // Constraint might already exist with a different name, or there's a duplicate key issue
          if (constraintError.message?.includes('already exists') || constraintError.message?.includes('duplicate key')) {
            console.log('Unique constraint already exists (possibly with different name)');
          } else {
            console.warn('Could not verify/add unique constraint:', constraintError.message);
          }
        }
      }
    } catch (error: any) {
      console.error('✗ Error creating site_content table:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        name: error?.name
      });
      // Don't throw - allow app to continue even if table creation fails
      // But log it clearly so admin knows to create it manually
      console.error('⚠️  Please run the SQL script in migrations/create_site_content_table.sql manually');
    }
  }

  async createGiftCardsTable() {
    try {
      // Check if table exists first
      const tableExistsResult = await this.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'gift_cards'
        ) as exists;
      `, { type: QueryTypes.SELECT }) as Array<{ exists: boolean }>;

      const exists = tableExistsResult && tableExistsResult.length > 0 && tableExistsResult[0]?.exists === true;

      if (!exists) {
        console.log('Creating gift_cards table...');
        
        // Create table with all required fields
        await this.sequelize.query(`
          CREATE TABLE gift_cards (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            code VARCHAR(255) NOT NULL UNIQUE,
            email VARCHAR(255) NOT NULL,
            stripe_session_id VARCHAR(255),
            stripe_payment_intent_id VARCHAR(255),
            amount VARCHAR(255) NOT NULL,
            purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            used_at TIMESTAMP,
            used_by_user_id UUID,
            used_by_email VARCHAR(255),
            is_used BOOLEAN DEFAULT FALSE,
            quantity INTEGER,
            purchase_group_id UUID,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Create index on code for faster lookups
        await this.sequelize.query(`
          CREATE INDEX IF NOT EXISTS gift_cards_code_idx ON gift_cards(code);
        `);

        // Create index on email for faster queries
        await this.sequelize.query(`
          CREATE INDEX IF NOT EXISTS gift_cards_email_idx ON gift_cards(email);
        `);

        // Create index on is_used for faster filtering
        await this.sequelize.query(`
          CREATE INDEX IF NOT EXISTS gift_cards_is_used_idx ON gift_cards(is_used);
        `);

        // Create index on purchase_group_id for grouping related cards
        await this.sequelize.query(`
          CREATE INDEX IF NOT EXISTS gift_cards_purchase_group_id_idx ON gift_cards(purchase_group_id);
        `);

        console.log('✓ Gift cards table created successfully');
      } else {
        console.log('✓ Gift cards table already exists');
        
        // Check if new columns exist and add them if they don't
        try {
          const columnsResult = await this.sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'gift_cards'
            AND column_name IN ('quantity', 'purchase_group_id')
          `, { type: QueryTypes.SELECT }) as Array<{ column_name: string }>;
          
          const existingColumns = columnsResult.map(col => col.column_name);
          
          if (!existingColumns.includes('quantity')) {
            console.log('Adding quantity column to gift_cards table...');
            await this.sequelize.query(`
              ALTER TABLE gift_cards 
              ADD COLUMN quantity INTEGER;
            `);
            console.log('✓ quantity column added');
          }
          
          if (!existingColumns.includes('purchase_group_id')) {
            console.log('Adding purchase_group_id column to gift_cards table...');
            await this.sequelize.query(`
              ALTER TABLE gift_cards 
              ADD COLUMN purchase_group_id UUID;
            `);
            await this.sequelize.query(`
              CREATE INDEX IF NOT EXISTS gift_cards_purchase_group_id_idx ON gift_cards(purchase_group_id);
            `);
            console.log('✓ purchase_group_id column added');
          }
        } catch (migrationError: any) {
          console.error('⚠️  Error adding new columns to gift_cards table:', migrationError?.message);
          // Don't throw - allow app to continue
        }
      }
    } catch (error: any) {
      console.error('✗ Error creating gift_cards table:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        name: error?.name
      });
      // Don't throw - allow app to continue even if table creation fails
    }
  }

  async initializeEmailTemplates() {
    try {
      const EmailTemplate = this.sequelize.models.EmailTemplate;
      if (!EmailTemplate) return;

      // Define all email templates that should exist in the database
      const templatesToSync = [
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
          body: '<p>Hi ${userName},</p><p>Your visa application status has been updated:</p><p><strong>Previous Status:</strong> ${oldStatus || "Unknown"}</p><p><strong>New Status:</strong> ${status}</p><p><strong>Message:</strong> ${message}</p>${notes ? `<p><strong>Additional Notes:</strong> ${notes}</p>` : ""}',
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
          body: '<p>Hi ${userName},</p><p>Your visa application status has been updated.</p><p><strong>Application Number:</strong> ${applicationNo}</p><p><strong>Status:</strong> ${status}</p>${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}<p>Please contact us if you have any questions.</p>',
          description: 'Email template for rejected applications',
          isActive: true,
        },
        {
          key: 'gift_card_purchase',
          name: 'Gift Card Purchase',
          subject: 'Your Gift Card Purchase - Redemption Code',
          body: '<p>Hi,</p><p>Thank you for your gift card purchase!</p><p>Your gift card redemption code is:</p><div style="text-align: center; margin: 24px 0 12px 0;"><img src="cid:gift-card-image" alt="NUvisa gift card" style="max-width: 100%; height: auto; border-radius: 12px; display: inline-block; box-shadow: 0 8px 20px rgba(0,0,0,0.08);"></div><p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #000000; background: #f5f5f5; padding: 20px; display: inline-block; border-radius: 8px; margin: 20px 0; font-family: monospace;">${code}</p><p><strong>Purchase Amount:</strong> £${amount}</p><p>You can use this code during checkout to get <strong>1 free traveller and 1 free insurance</strong>.</p><p><strong>Important:</strong> This code can only be used once and will expire upon use.</p><p>If you have any questions, please contact us at support@nuvisa.co.uk</p>',
          description: 'Email template for gift card purchase confirmation',
          isActive: true,
        },
      ];

      // Check existing templates
      const existingTemplates = await EmailTemplate.findAll();
      const existingKeys = new Set(existingTemplates.map(t => t.get('key') as string));

      // Only create missing templates - don't overwrite existing ones to preserve admin edits
      const templatesToCreate = templatesToSync.filter(t => !existingKeys.has(t.key));
      
      if (templatesToCreate.length > 0) {
        await EmailTemplate.bulkCreate(templatesToCreate);
        console.log(`Created ${templatesToCreate.length} new email template(s)`);
      }

      if (templatesToCreate.length === 0 && existingTemplates.length === templatesToSync.length) {
        console.log('All email templates are already initialized');
      }
    } catch (error) {
      console.error('Failed to initialize email templates:', error);
    }
  }
}
