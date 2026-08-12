import { NextRequest, NextResponse } from 'next/server';
import { encode } from '@auth/core/jwt';
import { prisma } from '@/lib/prisma';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import crypto from 'crypto';

// Apple Guideline 5.1.1(v): apps cannot require account registration (sharing personal info)
// before letting a user access app content/features or purchase non-account-based IAP.
// This endpoint creates a fully anonymous, device-local "guest" account with no email/name/
// password collected from the user at all — it just unlocks the app and Vitra Pro purchases
// immediately. The user can later optionally call /api/auth/link-guest-account to attach a
// real email+password (or Apple/Google) to this exact same user row, preserving all their
// data, if they want to sync across devices.
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const ipLimit = rateLimit(`guest-signin-ip:${ip}`, 20, 60 * 60 * 1000);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000)) } }
      );
    }

    const guestId = crypto.randomBytes(16).toString('hex');
    const user = await prisma.user.create({
      data: {
        email: `guest_${guestId}@guest.myvitra.org`,
        name: 'Guest',
        isGuest: true,
        emailVerified: new Date(), // no verification needed — nothing to verify
        subscriptionStatus: { create: { tier: 'free' } },
      },
    });

    const isSecure = process.env.NODE_ENV === 'production';
    const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token';

    const secret = process.env.AUTH_SECRET!;
    const token = await encode({
      token: {
        sub: user.id,
        id: user.id,
        email: user.email,
        name: user.name ?? undefined,
        isGuest: true,
      },
      secret,
      salt: cookieName,
      maxAge: MAX_AGE,
    });

    const response = NextResponse.json({
      ok: true,
      token,
      cookieName,
      user: { id: user.id, email: user.email, name: user.name, isGuest: true },
    });

    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: MAX_AGE,
    });

    return response;
  } catch (err) {
    console.error('[mobile-guest-signin] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
