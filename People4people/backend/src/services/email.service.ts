import crypto from 'crypto';

export type EmailResult = { sent: true } | { sent: false; reason: 'missing_key' | 'provider_error'; status?: number; message?: string };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]!));
}

export async function sendEmail(to: string, subject: string, html: string): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (process.env.EMAIL_DELIVERY_MODE === 'test') return { sent: true };
  if (!apiKey) {
    console.error('[EMAIL ERROR] RESEND_API_KEY is missing');
    return { sent: false, reason: 'missing_key', message: 'RESEND_API_KEY is not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'People for People <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (response.ok) return { sent: true };

    const responseText = await response.text();
    let message = responseText;
    try {
      const parsed = JSON.parse(responseText);
      message = parsed.message || parsed.name || responseText;
    } catch {
      // Provider returned plain text.
    }
    message = message.slice(0, 1000);
    console.error('[EMAIL ERROR] Resend returned HTTP', response.status, message);
    return { sent: false, reason: 'provider_error', status: response.status, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resend request failed';
    console.error('[EMAIL ERROR] Resend request failed', message);
    return { sent: false, reason: 'provider_error', message };
  }
}

export async function sendVerificationEmail(toEmail: string, name: string, token: string): Promise<EmailResult> {
  const frontendUrl = (process.env.FRONTEND_URL || process.env.RENDER_FRONTEND_URL || process.env.APP_ORIGIN || 'http://localhost:5173')
    .trim().replace(/\/+$/, '');
  const verificationLink = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmail(
    toEmail,
    'Verify your People for People account',
    `<h2>Welcome to People for People, ${escapeHtml(name)}</h2>
      <p>Please verify your email address:</p>
      <p><a href="${verificationLink}">Verify my account</a></p>
      <p>This link expires in one hour and can only be used once.</p>`,
  );
}

export function hashVerificationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
