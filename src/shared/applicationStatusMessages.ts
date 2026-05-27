/**
 * Applicant-facing visa application status copy (emails + API messages).
 */

export const APPLICATION_STATUS_EMAIL_MESSAGES: Record<string, string> = {
  submitted: 'Your application has been received',
  under_review: 'Documents are being reviewed by our team',
  appointment_booked: 'Visa appointment has been successfully scheduled',
  at_embassy: 'Application is currently at the embassy',
  decision_made: 'A final decision has been made on your application',
  approved: 'Congratulations! Your visa application has been approved.',
  rejected:
    'Unfortunately, your visa application has been rejected. Please contact us for more information.',
  payment_required: 'Additional payment is required to continue your application.',
  processing: 'Documents are being reviewed by our team',
  cancelled: 'Your visa application has been cancelled.',
  completed: 'Your visa application has been completed successfully.',
};

export function normalizeApplicationStatusKey(status?: string): string {
  return String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function getApplicationStatusEmailMessage(
  status?: string,
  statusMessage?: string | null,
): string {
  if (statusMessage && String(statusMessage).trim()) {
    return String(statusMessage).trim();
  }

  const key = normalizeApplicationStatusKey(status);
  return (
    APPLICATION_STATUS_EMAIL_MESSAGES[key] ||
    `Your application status has been updated to: ${String(status || '').replace(/_/g, ' ')}`
  );
}

export function getApplicationStatusEmailLabel(
  status?: string,
  statusDisplay?: string | null,
): string {
  if (statusDisplay && String(statusDisplay).trim()) {
    return String(statusDisplay).trim();
  }

  const key = normalizeApplicationStatusKey(status);
  const labels: Record<string, string> = {
    submitted: 'Application submitted',
    under_review: 'Under review',
    appointment_booked: 'Appointment booked',
    at_embassy: 'At Embassy',
    decision_made: 'Decision made, passport dispatched/ready',
    approved: 'Approved',
    rejected: 'Rejected',
    payment_required: 'Payment required',
  };

  return (
    labels[key] ||
    String(status || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
  );
}
