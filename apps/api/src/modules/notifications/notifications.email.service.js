import { env } from '../../config/env.js';

function getConfiguredRecipient() {
  return String(process.env.JOB_NOTIFICATIONS_EMAIL || env.JOB_NOTIFICATIONS_EMAIL || '').trim();
}

export function resolveJobNotificationRecipient() {
  return getConfiguredRecipient();
}

export async function sendJobNotificationEmail({ to, subject, html, text, metadata }) {
  const recipient = String(to || getConfiguredRecipient() || '').trim();
  if (!recipient) {
    console.info('[notifications.email] email_skipped', { subject, reason: 'recipient_missing', metadata: metadata || null });
    return { sent: false, reason: 'recipient_missing' };
  }

  console.info('[notifications.email] email_queued', {
    to: recipient,
    subject,
    text: String(text || '').slice(0, 500),
    metadata: metadata || null
  });

  return { sent: true, to: recipient, subject, html, text, metadata };
}
