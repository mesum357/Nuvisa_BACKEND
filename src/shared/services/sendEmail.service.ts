import { callHTTPException } from "../exceptions";
import { transporter } from "./nodeMailer";
import { emailTemplates } from "../../email_templates";
import { Env } from "../config";

export async function sendEmail(emailMeta, footerContent?: any) {
  try {
    const { emailAddress, subject, body } = emailMeta;
    
    if (!emailAddress || !subject) {
      throw new Error("Email address and subject are required");
    }

    // Convert relative logo URLs to absolute URLs
    if (footerContent?.logo && footerContent.logo.trim() !== '') {
      if (!footerContent.logo.startsWith('http')) {
        const baseUrl = Env.WEBSITE_URL || 'https://nuvisa.co.uk';
        const cleanPath = footerContent.logo.startsWith('/') ? footerContent.logo : `/${footerContent.logo}`;
        footerContent.logo = `${baseUrl}${cleanPath}`;
      }
    }

    const emailTemplate = getEmailTemplateHeaderFooter(body, footerContent);

    const mailOptions = {
      from: Env.MAILER_FROM_EMAIL,
      to: emailAddress,
      subject: subject,
      html: emailTemplate,
    };

    const result = await transporter.sendMail(mailOptions);
    return result;
  } catch (err) {
    console.error("Failed to send email:", err);
    throw new Error(`Failed to send email: ${err.message}`);
  }
}

const getEmailTemplateHeaderFooter = (emailContent, footerContent?: any) => {
  // Get logo URL
  const logoUrl = footerContent?.logo || '';
  
  // Logo HTML - use image if available, otherwise use text
  const logoHTML = logoUrl
    ? `<img src="${logoUrl}" alt="NUvisa" style="max-width: 150px; height: auto; margin: 0 auto; display: block;">`
    : '<h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #000000; letter-spacing: -0.5px;">NUvisa</h1>';
  
  // Build social media links
  const socialLinks = [
    { key: 'twitter', url: footerContent?.twitter || '#' },
    { key: 'facebook', url: footerContent?.facebook || '#' },
    { key: 'instagram', url: footerContent?.instagram || '#' },
    { key: 'linkedin', url: footerContent?.linkedin || '#' }
  ];
  
  // Get company info from footer content
  const companyInfo = footerContent?.companyInfo || [
    'If you would like to find out more about NUvisa, please reach out to us via support@nuvisa.co.uk'
  ];

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>NUvisa</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, a { font-family: Arial, sans-serif !important; }
    </style>
  <![endif]-->
  </head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #ffffff;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width: 100%; margin: 0; padding: 0;">
    <tr>
      <td style="padding: 0; margin: 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Logo Section -->
          <tr>
            <td style="padding: 40px 0 30px 0; text-align: center;">
              ${logoHTML}
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 40px 40px 40px;">
      ${emailContent}
            </td>
          </tr>
          
          <!-- Team Signature -->
          <tr>
            <td style="padding: 0 40px 20px 40px; text-align: left; border-top: 1px solid #e5e5e5;">
              <p style="margin: 30px 0 20px 0; font-size: 14px; line-height: 20px; color: #000000;">
                — Team NUvisa
              </p>
            </td>
          </tr>
          
          <!-- Social Media Icons -->
          <tr>
            <td style="padding: 20px 40px; text-align: center;">
              <a href="${socialLinks[0].url}" style="margin: 0 8px; text-decoration: none; display: inline-block; width: 32px; height: 32px; background-color: #000000; border-radius: 50%; text-align: center; line-height: 32px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style="vertical-align: middle;">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="${socialLinks[1].url}" style="margin: 0 8px; text-decoration: none; display: inline-block; width: 32px; height: 32px; background-color: #1877F2; border-radius: 50%; text-align: center; line-height: 32px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style="vertical-align: middle;">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a href="${socialLinks[2].url}" style="margin: 0 8px; text-decoration: none; display: inline-block; width: 32px; height: 32px; background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%); border-radius: 50%; text-align: center; line-height: 32px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style="vertical-align: middle;">
                  <circle cx="12" cy="12" r="4"></circle>
                  <path d="M8 3H16a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H8zm10 1a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                </svg>
              </a>
              <a href="${socialLinks[3].url}" style="margin: 0 8px; text-decoration: none; display: inline-block; width: 32px; height: 32px; background-color: #0077B5; border-radius: 50%; text-align: center; line-height: 32px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style="vertical-align: middle;">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </td>
          </tr>
          
          <!-- Copyright -->
          <tr>
            <td style="padding: 0 40px 20px 40px; text-align: left; border-top: 1px solid #e5e5e5;">
              <p style="margin: 20px 0 16px 0; font-size: 14px; line-height: 20px; color: #000000;">
                © ${new Date().getFullYear()} NUvisa Ltd
              </p>
              
              <!-- Company Information -->
              ${companyInfo.map(info => `
                <p style="margin: 0 0 16px 0; font-size: 12px; line-height: 16px; color: #666666;">
                  ${info}
                </p>
              `).join('')}
            </td>
          </tr>
          
          <!-- Bottom Logo -->
          <tr>
            <td style="padding: 20px 40px 40px 40px; text-align: center; border-top: 1px solid #e5e5e5;">
              ${logoUrl 
                ? `<img src="${logoUrl}" alt="NUvisa" style="max-width: 100px; height: auto; margin: 0 auto; display: block; opacity: 0.7;">`
                : '<h2 style="margin: 0; font-size: 14px; font-weight: 400; color: #666666; letter-spacing: 0.5px;">NUvisa</h2>'
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  </body>
</html>
`;
};

// Helper function to generate social media icon SVGs
function getSocialIconSVG(platform: string): string {
  const icons: Record<string, string> = {
    twitter: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20.055 7.983c.012.174.012.347.012.521 0 5.325-4.053 11.461-11.46 11.461-2.282 0-4.402-.661-6.186-1.809.324.037.63.05.96.05 1.884 0 3.614-.64 4.99-1.717-1.758-.033-3.244-1.186-3.758-2.772.247.047.495.072.756.072.36 0 .72-.05 1.056-.144-1.839-.371-3.223-1.986-3.223-3.925v-.05c.54.301 1.16.493 1.818.513A3.77 3.77 0 0 1 4.69 6.26c-1.24-1.38-.666-3.682.977-4.146 1.452-.494 2.932.46 2.98 1.96a3.257 3.257 0 0 0 1.73-.99c-.417 1.417-1.84 2.44-3.476 2.49 1.402.934 3.136 1.417 5.013 1.417-1.297 1.034-3.06 1.61-4.919 1.61H3.569c1.764 1.339 3.85 2.124 6.094 2.124 7.315 0 11.314-6.063 11.314-11.323 0-.173-.008-.345-.017-.52A8.084 8.084 0 0 0 21.5 5.86z" fill.lib="#000000"/></svg>',
    facebook: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20.447 2H3.553A1.553 1.553 0 0 0 2 3.553v16.894A1.553 1.553 0 0 0 3.553 22h8.823v-7.294H9.706v-2.706h2.67v-2.006c0-2.643 1.613-4.082 3.972-4.082 1.13 0 2.099.084 2.382.122v2.76h-1.634c-1.28 0-1.527.608-1.527 1.499v1.896h3.046l-.397 2.706h-2.649V22h4.686a1.553 1.553 0 0 0 1.553-1.553V3.553A1.553 1.553 0 0 0 20.447 2z" fill="#000000"/></svg>',
    instagram: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12.5" r="3.094" stroke="#000000" stroke-width="1.5" fill="none"/><path d="M17 3.5H7a3.5 3.5 0 0 0-3.5 3.5v10a3.5 3.5 0 0 0 3.5 3.5h10a3.5 3.5 0 0 0 3.5-3.5V7a3.5 3.5 0 0 0-3.5-3.5z" stroke="#000000" stroke-width="1.5" fill="none"/><circle cx="16.906" cy="7.1" r=".786" fill="#000000"/></svg>',
    linkedin: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" fill="#000000"/></svg>',
  };
  
  return icons[platform] || '<span style="display: inline-block; width: 24px; height: 24px; background-color: #000000; border-radius: 50%;"></span>';
}

export async function renderTemplate(templateKey, dynamicData) {
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

export async function renderTemplateFromDB(templateKey, dynamicData, template) {
  try {
    if (!template) {
      throw new Error(`Template with key "${templateKey}" not found.`);
    }

    const subject = template.subject.replace(
      /\${(.*?)}/g,
      (_, key) => dynamicData[key] || ""
    );
    const emailBody = template.body.replace(
      /\${(.*?)}/g,
      (_, key) => dynamicData[key] || ""
    );

    return { subject, emailBody };
  } catch (err) {
    callHTTPException("Error Rendering Email Template");
  }
}
