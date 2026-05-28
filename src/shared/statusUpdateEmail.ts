/**
 * Applicant status-update email copy (admin-triggered via backend).
 */

export const STATUS_UPDATE_EMAIL_SUBJECT = (applicationNo: string) =>
  `Application ${applicationNo} Status Update`;

/** For DB template sync — subject uses ${applicationNo} placeholder. */
export const STATUS_UPDATE_EMAIL_TEMPLATE_SUBJECT =
  'Application ${applicationNo} Status Update';

export const STATUS_UPDATE_EMAIL_TEMPLATE_BODY =
  '<p>Hi Applicant,</p><p>Your visa application status has been updated:</p><p><strong>New Status:</strong> ${status}</p><p><strong>Message:</strong> ${message}</p>${notes ? `<p><strong>Note:</strong> ${notes}</p>` : ""}';

export function buildStatusUpdateEmailHtml(
  statusLabel: string,
  statusMessage: string,
  notes?: string | null,
): string {
  const noteBlock =
    notes && String(notes).trim()
      ? `<p><strong>Note:</strong> ${String(notes).trim()}</p>`
      : '';

  return (
    `<p>Hi Applicant,</p>` +
    `<p>Your visa application status has been updated:</p>` +
    `<p><strong>New Status:</strong> ${statusLabel}</p>` +
    `<p><strong>Message:</strong> ${statusMessage}</p>` +
    noteBlock
  );
}
