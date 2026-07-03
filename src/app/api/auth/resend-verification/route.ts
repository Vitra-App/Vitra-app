import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const { email: rawEmail } = await req.json().catch(() => ({}));
  if (!rawEmail || typeof rawEmail !== 'string') {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }
  const email = rawEmail.toLowerCase().trim();

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
