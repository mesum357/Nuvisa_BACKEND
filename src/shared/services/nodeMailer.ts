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

// Log the configuration to the console for debugging
console.log("NODEMAILER_CONFIG:", JSON.stringify(transporterConfig, null, 2));

// Create the transporter with the config
export const transporter = createTransport(transporterConfig);
