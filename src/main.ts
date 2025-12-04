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

  app.use(
    bodyParser.json({
      limit: "50mb",
      verify: (req: any, res, buf: Buffer) => {
        const signature = req.headers["stripe-signature"];
        if (signature) {
          req.rawBody = buf; // Required for Stripe signature verification
        }
      },
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
  
  // Add Vercel URL if not already in environment
  if (!allowedOrigins.includes('https://nuvisa-fe.vercel.app')) {
    allowedOrigins.push('https://nuvisa-fe.vercel.app');
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
}

bootstrap();
