import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  // Prevent password-reset email spam / enumeration flooding.
  const ip = getClientIp(req);
  const ipLimit = rateLimit(`forgot-pw-ip:${ip}`, 10, 60 * 60 * 1000);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000)) } }
    );
  }
  const emailLimit = rateLimit(`forgot-pw-email:${email.toLowerCase().trim()}`, 4, 60 * 60 * 1000);
  if (!emailLimit.ok) {
    // Still return ok:true to avoid leaking that the email exists / was throttled.
    return NextResponse.json({ ok: true });
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

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3001';
  const resetUrl = `vitra://reset-password?token=${token}`;

  try {
    await sendPasswordResetEmail(user.email!, resetUrl);
  } catch {
    // Don't leak errors to the client
    console.error('[forgot-password] Failed to send email');
  }

  return NextResponse.json({ ok: true });
}
