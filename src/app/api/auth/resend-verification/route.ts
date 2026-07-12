import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/email';
import crypto from 'crypto';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const { email: rawEmail } = await req.json().catch(() => ({}));
  if (!rawEmail || typeof rawEmail !== 'string') {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }
  const email = rawEmail.toLowerCase().trim();

  // Prevent verification-email spam.
  const ip = getClientIp(req);
  const ipLimit = rateLimit(`resend-verify-ip:${ip}`, 10, 60 * 60 * 1000);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000)) } }
    );
  }
  const emailLimit = rateLimit(`resend-verify-email:${email}`, 4, 60 * 60 * 1000);
  if (!emailLimit.ok) {
    return NextResponse.json({ ok: true }); // avoid leaking account existence
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return ok to avoid leaking whether the account exists / is verified
  if (!user || user.emailVerified) {
    return NextResponse.json({ ok: true });
  }

  // Expire existing tokens for this email, then issue a fresh one
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

  await prisma.verificationToken.create({
    data: { identifier: email, token, expires },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3001';
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

  try {
    await sendVerificationEmail(email, verifyUrl);
  } catch {
    console.error('[resend-verification] Failed to send verification email');
  }

  return NextResponse.json({ ok: true });
}
