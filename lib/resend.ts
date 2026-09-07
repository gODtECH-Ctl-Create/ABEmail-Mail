import { Resend } from 'resend';

export function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is missing');
  return new Resend(apiKey);
}

export function getFromAddress() {
  return process.env.RESEND_FROM_EMAIL ?? 'ABEmail <info@waste2light.com>';
}

export function getMailboxFromAddress(mailbox: string) {
  const displayName = process.env.RESEND_FROM_NAME?.trim() || 'Waste2Light';
  return `${displayName} <${mailbox}>`;
}
