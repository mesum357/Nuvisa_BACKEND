const path = require("path");
const fs = require("fs");

const envPath = path.resolve(__dirname, "../../../.env");

if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
} else {
  require("dotenv").config();
}

// Derive DB settings from DATABASE_URL if provided; fallback to individual vars
const fromUrl = (() => {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return {};
  try {
    // Support both postgres:// and postgresql://
    const normalized = rawUrl.replace(/^postgres:\/\//, "postgresql://");
    const url = new URL(normalized);
    const host = url.hostname;
    const port = url.port || "5432";
    const username = decodeURIComponent(url.username || "");
    const password = decodeURIComponent(url.password || "");
    const database = (url.pathname || "/").replace(/^\//, "");

    // Detect SSL requirements: sslmode=require or known managed hosts
    const sslMode = url.searchParams.get("sslmode");
    const managedHost = /supabase\.co$|neon\.tech$|render\.com$|aws\.com$|herokuapp\.com$/.test(
      host
    );
    const ssl = (process.env.DATABASE_SSL || "").toLowerCase();
    const sslRequired =
      ssl === "true" || sslMode === "require" || managedHost ? true : false;

    return {
      host,
      port,
      username,
      password,
      database,
      sslRequired,
    };
  } catch (_) {
    return {};
  }
})();

const DATABASE_HOST = fromUrl.host || process.env.DATABASE_HOST;
const DATABASE_PORT = fromUrl.port || process.env.DATABASE_PORT;
const DATABASE_NAME = fromUrl.database || process.env.DATABASE_NAME;
const DATABASE_USER = fromUrl.username || process.env.DATABASE_USER;
const DATABASE_PASSWORD = fromUrl.password || process.env.DATABASE_PASSWORD;
const DATABASE_SSL = String(
  typeof fromUrl.sslRequired === "boolean"
    ? fromUrl.sslRequired
    : (process.env.DATABASE_SSL || "false").toLowerCase() === "true"
);

export default {
  jwt_secret: process.env.JWT_SECRET,
  PORT: process.env.PORT,
  DATABASE_HOST,
  DATABASE_NAME,
  DATABASE_USER,
  DATABASE_PASSWORD,
  DATABASE_PORT,
  DATABASE_SSL,
  WEBSITE_URL: process.env.WEBSITE_URL,

  MAILER_EMAIL: process.env.MAILER_EMAIL,
  MAILER_GMAIL_PASSWORD: process.env.MAILER_GMAIL_PASSWORD,

  Environment: process.env.env,

  MAILER_SMTP_PASSWORD: process.env.MAILER_SMTP_PASSWORD,
  APP_ENV: process.env.APP_ENV,

  MAILER_FROM_EMAIL: process.env.MAILER_FROM_EMAIL,

  // SMTP Configuration for mail.privateemail.com
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,

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

  // CORS Configuration
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:3002,http://localhost:4000",
  ALLOW_ORIGIN_NOAUTH: process.env.ALLOW_ORIGIN_NOAUTH || "http://localhost:3002",
};
