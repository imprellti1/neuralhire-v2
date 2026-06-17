import { env } from '../../config/env.js';

export function getCommercialAlertRecipient() {
  return String(process.env.COMMERCIAL_ALERT_EMAIL_TO || env.COMMERCIAL_ALERT_EMAIL_TO || '').trim();
}

export async function sendCommercialJobEmail({ subject, text, html }) {
  const to = getCommercialAlertRecipient();
  if (!to) {
    console.info('[jobs.mailer] email_skipped', { subject });
    return { sent: false, reason: 'recipient_missing' };
  }
  console.info('[jobs.mailer] email_logged', { to, subject, text: String(text || '').slice(0, 300) });
  return { sent: true, to, subject, text, html };
}

