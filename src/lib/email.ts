/**
 * Email sending via Resend (resend.com).
 * Falls back to a console log when RESEND_API_KEY is not set.
 */

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? 'Vitra <noreply@vitra.app>';

  if (!apiKey) {
    // Dev fallback — log the link so devs can test without a real key
    console.info(`[password-reset] Reset link for ${to}: ${resetUrl}`);
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#f8fafc;padding:40px 20px">
  <div style="max-width:480px;margin:0 auto;background:white;border-radius:16px;padding:40px;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
    <h1 style="color:#0f172a;font-size:24px;margin:0 0 8px">Reset your password</h1>
    <p style="color:#64748b;font-size:15px;margin:0 0 32px">
      Click the button below to choose a new password. This link expires in 1 hour.
    </p>
    <a href="${resetUrl}" style="display:inline-block;background:#22c55e;color:white;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:15px">
      Reset Password
    </a>
    <p style="color:#94a3b8;font-size:13px;margin:32px 0 0">
      If you didn't request this, you can safely ignore this email.
    </p>
  </div>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Reset your Vitra password',
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[email] Resend error:', res.status, body);
    throw new Error('Failed to send password reset email');
  }
}
