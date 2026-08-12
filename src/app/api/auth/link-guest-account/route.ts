import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/email';
import { encode } from '@auth/core/jwt';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const MAX_AGE = 30 * 24 * 60 * 60;

// Lets a guest user (created via /api/auth/mobile-guest-signin) *optionally* attach a real
// email + password to their existing account, in-place — preserving every meal log, weight
// entry, subscription, etc. already tied to that user id. This is the "optional registration"
// path Apple's Guideline 5.1.1(v) requires: registration must never be forced, only offered as
// a way to sync data/purchases across devices.
const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(req);
  const ipLimit = rateLimit(`link-guest-ip:${ip}`, 10, 60 * 60 * 1000);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000)) } }
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input.' }, { status: 400 });
  }

  const currentUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!currentUser) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }
  if (!currentUser.isGuest) {
    return NextResponse.json(
      { error: 'This account is already registered. Sign out and use "Sign up" for a new account instead.' },
      { status: 409 }
    );
  }

  const { name, password } = parsed.data;
  const email = parsed.data.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      name,
      email,
      passwordHash,
      isGuest: false,
      emailVerified: null, // must verify the newly-provided real email
    },
  });

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);
  await prisma.verificationToken.create({ data: { identifier: email, token, expires } });

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3001';
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

  try {
    await sendVerificationEmail(email, verifyUrl);
  } catch {
    console.error('[link-guest-account] Failed to send verification email');
  }

  // Re-issue a fresh session token reflecting the new (unverified) email/name so the app's
  // cached session isn't left showing the stale guest_xxx@guest.myvitra.org placeholder.
  // NOTE: sign-in with a password still requires email verification (see auth.ts authorize()),
  // but the mobile app keeps this cookie-based session alive across the verification step since
  // it was never signed out — only future password-based re-logins require verification.
  const isSecure = process.env.NODE_ENV === 'production';
  const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token';
  const newToken = await encode({
    token: { sub: currentUser.id, id: currentUser.id, email, name, isGuest: false },
    secret: process.env.AUTH_SECRET!,
    salt: cookieName,
    maxAge: MAX_AGE,
  });

  const response = NextResponse.json({
    ok: true,
    token: newToken,
    cookieName,
    user: { id: currentUser.id, email, name, isGuest: false },
  });
  response.cookies.set(cookieName, newToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
  return response;
}
