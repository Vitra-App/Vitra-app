import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
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
