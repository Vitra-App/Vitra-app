import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { encode } from '@auth/core/jwt';
import { prisma } from '@/lib/prisma';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Brute-force protection: limit by IP (covers spray attacks) and by email
    // (covers distributed/botnet attacks targeting a single account).
    const ip = getClientIp(req);
    const ipLimit = rateLimit(`signin-ip:${ip}`, 20, 15 * 60 * 1000);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000)) } }
      );
    }
    const emailLimit = rateLimit(`signin-email:${String(email).toLowerCase()}`, 10, 15 * 60 * 1000);
    if (!emailLimit.ok) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts for this account. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(emailLimit.retryAfterMs / 1000)) } }
      );
    }

    const user = await prisma.user.findUnique({ where: { email: String(email) } });
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Require a verified email before allowing sign-in
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: 'Please verify your email before signing in. Check your inbox for the verification link.', code: 'email_not_verified' },
        { status: 403 }
      );
    }

    // In production (HTTPS), NextAuth v5 uses __Secure- prefix on cookie name and salt
    const isSecure = process.env.NODE_ENV === 'production';
    const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token';

    const secret = process.env.AUTH_SECRET!;
    const token = await encode({
      token: {
        sub: user.id,
        id: user.id,
        email: user.email,
        name: user.name ?? undefined,
        picture: user.image ?? undefined,
      },
      secret,
      salt: cookieName,   // salt MUST match the cookie name NextAuth uses to decode
      maxAge: MAX_AGE,
    });

    const response = NextResponse.json({
      ok: true,
      token,
      cookieName,  // tell iOS which cookie name to use
      user: { id: user.id, email: user.email, name: user.name },
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
    console.error('[mobile-signin] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
