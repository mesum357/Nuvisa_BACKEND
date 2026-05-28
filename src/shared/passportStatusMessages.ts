/**
 * Applicant-facing copy for passport final-stage admin status keys.
 */

const PASSPORT_STATUS_LABEL = 'Decision made, passport dispatched/ready';

const PASSPORT_STATUS_MESSAGES: Record<string, string> = {
  DECISION_MADE: 'A final decision has been made on your application',
  PASSPORT_DISPATCHED:
    'Your passport has been dispatched. Please allow 3–5 working days for delivery.',
  PASSPORT_READY:
    'Your passport is ready for collection. Please visit us at your earliest convenience.',
};

export function getPassportStatusEmailCopy(
  adminStatusKey?: string | null,
): { label: string; message: string } | null {
  const key = String(adminStatusKey || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  if (!PASSPORT_STATUS_MESSAGES[key]) {
    return null;
  }

  return {
    label: PASSPORT_STATUS_LABEL,
    message: PASSPORT_STATUS_MESSAGES[key],
  };
}
