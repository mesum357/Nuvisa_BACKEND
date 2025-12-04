import { createTransport } from "nodemailer";
import { Env } from "../config";

// Get port and determine connection type
const smtpPort = Env.SMTP_PORT || 587;
const useSSL = smtpPort === 465; // Port 465 uses SSL, port 587 uses STARTTLS

// Get SMTP credentials with fallbacks
const smtpUser = Env.SMTP_USER || Env.MAILER_EMAIL;
const smtpPass = Env.SMTP_PASS || Env.MAILER_GMAIL_PASSWORD;
const smtpHost = Env.SMTP_HOST || "mail.privateemail.com";

// Validate SMTP configuration
if (!smtpUser || !smtpPass) {
  console.error("⚠️  SMTP Configuration Warning:");
  console.error("   SMTP_USER or SMTP_PASS is not set in environment variables");
  console.error("   Using fallback values - email sending may fail");
}

// Log SMTP configuration (without password) for debugging
console.log("📧 SMTP Configuration:");
console.log(`   Host: ${smtpHost}`);
console.log(`   Port: ${smtpPort}`);
console.log(`   User: ${smtpUser || "NOT SET"}`);
console.log(`   Password: ${smtpPass ? "***SET***" : "NOT SET"}`);
console.log(`   Secure (SSL): ${useSSL}`);

// Create the configuration object
const transporterConfig: any = {
  host: smtpHost,
  port: smtpPort,
  secure: useSSL, // true for SSL (port 465), false for STARTTLS (port 587)
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
  tls: {
    // Do not fail on invalid certificates (some SMTP servers use self-signed certs)
    rejectUnauthorized: false,
  },
};

// Only add requireTLS for STARTTLS connections (port 587)
if (!useSSL) {
  transporterConfig.requireTLS = true;
}

// Create the transporter with the config
export const transporter = createTransport(transporterConfig);

// Verify connection on startup (optional, can be removed if too verbose)
// transporter.verify().then(() => {
//   console.log("✅ SMTP server connection verified");
// }).catch((error) => {
//   console.error("❌ SMTP server connection failed:", error.message);
// });
