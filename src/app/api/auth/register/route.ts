import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/email';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export async function POST(req: NextRequest) {
  // Prevent mass account-creation / signup spam from a single source.
  const ip = getClientIp(req);
  const ipLimit = rateLimit(`register-ip:${ip}`, 8, 60 * 60 * 1000);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: 'Too many accounts created recently. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000)) } }
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input.' }, { status: 400 });
  }

  const { name, password } = parsed.data;
  const email = parsed.data.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      // emailVerified stays null until the user clicks the verification link
      subscriptionStatus: { create: { tier: 'free' } },
    },
  });

  // Create a verification token and email a verification link
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
    console.error('[register] Failed to send verification email');
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
