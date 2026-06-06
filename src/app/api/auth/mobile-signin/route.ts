/**
 * POST /api/auth/mobile-signin
 *
 * CSRF-free credentials endpoint for the iOS app.
 * Validates email + password, then issues a NextAuth v5-compatible
 * session cookie (authjs.session-token) using @auth/core/jwt encode.
 */
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { encode } from '@auth/core/jwt';
import { prisma } from '@/lib/prisma';

const COOKIE_NAME = 'authjs.session-token';
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: String(email) } });
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Build a NextAuth v5-compatible JWT token
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
      salt: COOKIE_NAME,
      maxAge: MAX_AGE,
    });

    const response = NextResponse.json({
      ok: true,
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
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
