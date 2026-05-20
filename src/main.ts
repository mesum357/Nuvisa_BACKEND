import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { Env } from "./shared/config";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import * as express from "express";
import * as bodyParser from "body-parser";
import { ErrorHandler } from "./shared/middlewares/error.middleware";

export let app: NestExpressApplication;

async function bootstrap() {
  app = await NestFactory.create<NestExpressApplication>(AppModule);

  const port = Env.PORT;

  // CRITICAL: Apply raw body parser to webhook route BEFORE any other body parsing
  // This MUST be first to capture the exact raw bytes before any JSON parsing
  // Using bodyParser.raw() with verify function - this is called BEFORE any parsing
  app.use(
    "/stripe_payment/webhook",
    bodyParser.raw({
      type: "application/json",
      limit: "50mb",
      verify: (req: any, res, buf: Buffer, encoding: string) => {
        // This verify function receives the raw Buffer BEFORE any parsing
        // Store it directly - this is the exact raw body Stripe needs
        req.rawBody = buf;
        console.log("✅ Raw body captured in middleware verify function");
        console.log("   Raw body type:", typeof req.rawBody);
        console.log("   Is Buffer:", Buffer.isBuffer(req.rawBody));
        console.log("   Raw body length:", req.rawBody?.length || 0);
      },
    })
  );

  // Global JSON parser for all other routes
  app.use(
    bodyParser.json({
      limit: "50mb",
    })
  );

  // Keep urlencoded after raw capture
  app.use(
    bodyParser.urlencoded({
      limit: "50mb",
      extended: true,
    })
  );

  const swagConfig = new DocumentBuilder()
    .setTitle("NUVISA")
    .setDescription("NUVISA APis")
    .setVersion("1.0")
    .addTag("")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swagConfig);
  SwaggerModule.setup("api", app, document);

  // CORS Configuration
  const allowedOrigins = Env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
  
  // Add Vercel URLs if not already in environment
  if (!allowedOrigins.includes('https://nuvisa-fe.vercel.app')) {
    allowedOrigins.push('https://nuvisa-fe.vercel.app');
  }
  if (!allowedOrigins.includes('https://nuvisa-admin-updated.vercel.app')) {
    allowedOrigins.push('https://nuvisa-admin-updated.vercel.app');
  }
  if (!allowedOrigins.includes('https://nuvisa-admin.vercel.app')) {
    allowedOrigins.push('https://nuvisa-admin.vercel.app');
  }
  
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-origin', 'x-admin-proxy'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    })
  );

  app.use(express.static("public"));

  app.useGlobalFilters(new ErrorHandler());

  app.set("trust proxy", 1);

  await app.listen(port);
  
  // Log server information
  const localUrl = `http://localhost:${port}`;
  const configuredUrl = Env.WEBSITE_URL ? Env.WEBSITE_URL.replace(/\/$/, '') : null;
  console.log('\n========================================');
  console.log('🚀 NUVISA Backend Server Started');
  console.log('========================================');
  console.log(`📡 Port: ${port}`);
  console.log(`🌐 Local URL: ${localUrl}`);
  if (configuredUrl) {
    console.log(`🌍 Configured URL: ${configuredUrl}`);
  }
  console.log(`📚 Swagger API Docs: ${localUrl}/api`);
  console.log(`🔗 Webhook Endpoint: ${localUrl}/stripe_payment/webhook`);
  console.log('========================================\n');
  console.log("backend updated----------------------")
}

bootstrap();
