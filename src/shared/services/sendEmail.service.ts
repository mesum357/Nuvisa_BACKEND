import { callHTTPException } from "../exceptions";
import { transporter } from "./nodeMailer";
import { emailTemplates } from "../../email_templates";
import { Env } from "../config";

export async function sendEmail(emailMeta) {
  try {
    const { emailAddress, subject, body } = emailMeta;
    
    if (!emailAddress || !subject) {
      throw new Error("Email address and subject are required");
    }

    const emailTemplate = getEmailTemplateHeaderFooter(body);

    const mailOptions = {
      from: Env.MAILER_FROM_EMAIL,
      to: emailAddress,
      subject: subject,
      html: emailTemplate,
    };

    console.log(`Sending email to: ${emailAddress} with subject: ${subject}`);
    const result = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully. Message ID: ${result.messageId}`);
    return result;
  } catch (err) {
    console.error("Failed to send email:", err);
    throw new Error(`Failed to send email: ${err.message}`);
  }
}

const getEmailTemplateHeaderFooter = (emailContent) => {
  return `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NUvisa Application Update</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f7f7f7;
        margin: 0;
        padding: 20px;
      }
      .container {
        max-width: 600px;
        margin: auto;
        background: #ffffff;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      .header {
        text-align: center;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 2px solid #e0e0e0;
      }
      .logo {
        font-size: 24px;
        font-weight: bold;
        color: #2563eb;
        margin-bottom: 10px;
      }
      h1 {
        font-size: 20px;
        margin-bottom: 20px;
        color: #333333;
      }
      p {
        font-size: 14px;
        color: #555555;
        line-height: 1.6;
        margin-bottom: 15px;
      }
      .status-box {
        background-color: #f8f9fa;
        border-left: 4px solid #2563eb;
        padding: 15px;
        margin: 20px 0;
        border-radius: 4px;
      }
      .footer {
        font-size: 12px;
        color: #999999;
        margin-top: 30px;
        text-align: center;
        padding-top: 20px;
        border-top: 1px solid #e0e0e0;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="logo">NUvisa</div>
        <p>Your trusted visa application partner</p>
      </div>
      ${emailContent}
      <div class="footer">
        <p>Best regards,<br />The NUvisa Team</p>
        <p>If you have any questions, please contact our support team.</p>
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
