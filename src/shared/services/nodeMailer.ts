import { createTransport } from "nodemailer";
import { Env } from "../config";
export const transporter = createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: true,
  auth: {
    user: Env.MAILER_EMAIL,
    pass: Env.MAILER_GMAIL_PASSWORD,
  },
});
