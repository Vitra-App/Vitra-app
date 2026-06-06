import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { encode } from '@auth/core/jwt';
import { prisma } from '@/lib/prisma';

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
