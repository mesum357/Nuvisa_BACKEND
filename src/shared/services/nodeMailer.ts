import { createTransport } from "nodemailer";
import { Env } from "../config";

// Create the configuration object first
const transporterConfig = {
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: Env.MAILER_EMAIL,
    pass: Env.MAILER_GMAIL_PASSWORD,
  },
};

// Create the transporter with the config
export const transporter = createTransport(transporterConfig);
