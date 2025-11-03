import { createTransport } from "nodemailer";
import { Env } from "../config";

// Get port and determine connection type
const smtpPort = Env.SMTP_PORT || 587;
const useSSL = smtpPort === 465; // Port 465 uses SSL, port 587 uses STARTTLS

// Create the configuration object
const transporterConfig: any = {
  host: Env.SMTP_HOST || "mail.privateemail.com",
  port: smtpPort,
  secure: useSSL, // true for SSL (port 465), false for STARTTLS (port 587)
  auth: {
    user: Env.SMTP_USER || Env.MAILER_EMAIL,
    pass: Env.SMTP_PASS || Env.MAILER_GMAIL_PASSWORD,
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
