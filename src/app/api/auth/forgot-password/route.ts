import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

  // Always return the same response to avoid leaking whether the email exists
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  // Expire any existing unused tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  // In a production app, send an email with the reset link.
  // For now, the reset link is returned in the response so it can be used directly.
  // Replace this with your email provider (e.g. Resend, SendGrid).
  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

  // TODO: send email — for now we surface the link in the response (dev only)
  console.log(`[password-reset] Reset link for ${email}: ${resetUrl}`);

  return NextResponse.json({ ok: true, resetUrl });
}
