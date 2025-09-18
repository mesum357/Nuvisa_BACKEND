export const emailTemplates = [
  {
    key: "otp_email",
    subject: "Your OTP Code",
    email_body: `
      <h1>One-Time Password (OTP)</h1>
      <p>Use the following OTP to complete your verification:</p>
      <div style="
        font-size: 24px; 
        font-weight: bold; 
        letter-spacing: 4px; 
        color: #2c3e50; 
        background: #f4f4f4; 
        padding: 10px 20px; 
        display: inline-block; 
        border-radius: 6px;
      ">
        \${otp}
      </div>
      <p>This code will expire in <strong>10 minutes</strong>.</p>
      <p>If you didn’t request this code, please ignore this email.</p>
      <br />
    `,
  },
];
