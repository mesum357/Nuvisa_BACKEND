const path = require("path");
const fs = require("fs");

const envPath = path.resolve(__dirname, "../../../.env");

if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
} else {
  require("dotenv").config();
}

export default {
  jwt_secret: process.env.JWT_SECRET,
  PORT: process.env.PORT,
  DATABASE_HOST: process.env.DATABASE_HOST,
  DATABASE_NAME: process.env.DATABASE_NAME,
  DATABASE_USER: process.env.DATABASE_USER,
  DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,

  DATABASE_PORT: process.env.DATABASE_PORT,
  WEBSITE_URL: process.env.WEBSITE_URL,

  MAILER_EMAIL: process.env.MAILER_EMAIL,
  MAILER_GMAIL_PASSWORD: process.env.MAILER_GMAIL_PASSWORD,

  Environment: process.env.env,

  MAILER_SMTP_PASSWORD: process.env.MAILER_SMTP_PASSWORD,
  APP_ENV: process.env.APP_ENV,

  MAILER_FROM_EMAIL: process.env.MAILER_FROM_EMAIL,

  VISA_API_VERSION: process.env.API_VERSION,
  VISA_API_SERVER: process.env.API_SERVER,
  VISA_API_CLIENT_ID: process.env.CLIENT_ID,
  VISA_API_CLIENT_SECRET: process.env.CLIENT_SECRET,

  Webhook_Secret: process.env.STRIPE_WEBHOOK_SECRET,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  HETZNER_S3_ENDPOINT: process.env.HETZNER_S3_ENDPOINT,
  HETZNER_S3_REGION: process.env.HETZNER_S3_REGION,
  HETZNER_S3_BUCKET_NAME: process.env.HETZNER_S3_BUCKET_NAME,
  HETZNER_S3_ACCESS_KEY: process.env.HETZNER_S3_ACCESS_KEY,
  HETZNER_S3_SECRET_KEY: process.env.HETZNER_S3_SECRET_KEY,
};
