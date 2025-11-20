export const emailTemplates = [
  {
    key: "status_update",
    subject: "Visa Application Status Update - ${status}",
    email_body: 
      "<p>Dear Applicant,</p>" +
      "<p>Your visa application status has been updated:</p>" +
      "<p><strong>Previous Status:</strong> ${oldStatus || 'Unknown'}</p>" +
      "<p><strong>New Status:</strong> ${status}</p>" +
      "<p><strong>Message:</strong> ${message}</p>" +
      "${notes ? `<p><strong>Additional Notes:</strong> ${notes}</p>` : ''}"
  },
  {
    key: "application_submitted",
    subject: "Visa Application Submitted Successfully",
    email_body: 
      "<p>Dear Applicant,</p>" +
      "<p>Your visa application has been submitted successfully.</p>" +
      "<p><strong>Application Number:</strong> ${applicationNo}</p>" +
      "<p>We will review your application and update you on the status.</p>"
  },
  {
    key: "application_approved",
    subject: "Visa Application Approved",
    email_body: 
      "<p>Dear Applicant,</p>" +
      "<p>Congratulations! Your visa application has been approved.</p>" +
      "<p><strong>Application Number:</strong> ${applicationNo}</p>" +
      "<p>Please check your account for further instructions.</p>"
  },
  {
    key: "application_rejected",
    subject: "Visa Application Update",
    email_body: 
      "<p>Dear Applicant,</p>" +
      "<p>Your visa application status has been updated.</p>" +
      "<p><strong>Application Number:</strong> ${applicationNo}</p>" +
      "<p><strong>Status:</strong> ${status}</p>" +
      "${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}" +
      "<p>Please contact us if you have any questions.</p>"
  }
];
