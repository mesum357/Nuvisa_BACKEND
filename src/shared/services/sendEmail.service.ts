import { callHTTPException } from "../exceptions";
import { transporter } from "./nodeMailer";
import { emailTemplates } from "../../email_templates";
import { Env } from "../config";

export async function sendEmail(emailMeta) {
  try {
    const { emailAddress, subject, body } = emailMeta;
    const emailTemplate = getEmailTemplateHeaderFooter(body);

    const mailOptions = {
      from: Env.MAILER_FROM_EMAIL,
      to: emailAddress,
      subject: subject,
      html: emailTemplate,
    };

    return await transporter.sendMail(mailOptions);
  } catch (err) {
    callHTTPException("Failed to send an email");
  }
}

const getEmailTemplateHeaderFooter = (emailContent) => {
  return `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Email</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f7f7f7;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: auto;
        background: #ffffff;
        padding: 20px;
        border-radius: 8px;
      }
      h1 {
        font-size: 20px;
        margin-bottom: 20px;
        color: #333333;
      }
      p {
        font-size: 14px;
        color: #555555;
      }
      .footer {
        font-size: 12px;
        color: #999999;
        margin-top: 30px;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Your One-Time Password (OTP)</h1>
      ${emailContent}
      <p>Thank you for choosing us.</p>
      <div class="footer">
        Best regards,<br />
        The Team
      </div>
    </div>
  </body>
</html>
`;
};

export function renderTemplate(templateKey, dynamicData) {
  try {
    const template = emailTemplates.find((t) => t.key === templateKey);
    if (!template) {
      throw new Error(`Template with key "${templateKey}" not found.`);
    }

    const subject = template.subject.replace(
      /\${(.*?)}/g,
      (_, key) => dynamicData[key] || ""
    );
    const emailBody = template.email_body.replace(
      /\${(.*?)}/g,
      (_, key) => dynamicData[key] || ""
    );

    return { subject, emailBody };
  } catch (err) {
    callHTTPException("Error Rendering Email Template");
  }
}
