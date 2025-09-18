import { createTransport } from "nodemailer";
import { Env } from "../config";
export const transporter = createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: Env.MAILER_EMAIL,
    // pass: Env.MAILER_SMTP_PASSWORD,
    pass: Env.MAILER_GMAIL_PASSWORD,
  },
});
