import { NextRequest, NextResponse } from 'next/server';
import { encode } from '@auth/core/jwt';
import { prisma } from '@/lib/prisma';
import { OAuth2Client } from 'google-auth-library';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const MAX_AGE = 30 * 24 * 60 * 60;

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const ipLimit = rateLimit(`google-signin-ip:${ip}`, 30, 60 * 60 * 1000);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000)) } }
      );
    }

    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: 'idToken required' }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: 'Google Sign In not configured' }, { status: 503 });
    }

    // Verify Google ID token
    const client = new OAuth2Client(clientId);
    let ticket;
    try {
      ticket = await client.verifyIdToken({ idToken, audience: clientId });
    } catch {
      return NextResponse.json({ error: 'Invalid Google ID token' }, { status: 401 });
    }

    const payload = ticket.getPayload();
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 });
    }

    const googleId = payload.sub;
    const googleEmail = payload.email;
    const googleName = payload.name;

    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        accounts: { some: { provider: 'google', providerAccountId: googleId } },
      },
    });

    if (!user && googleEmail) {
      user = await prisma.user.findUnique({ where: { email: googleEmail } });
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: googleEmail ?? `google_${googleId}@private.vitra.app`,
          name: googleName ?? 'Vitra User',
          emailVerified: new Date(),
        },
      });
    }

    await prisma.account.upsert({
      where: { provider_providerAccountId: { provider: 'google', providerAccountId: googleId } },
      create: { userId: user.id, type: 'oauth', provider: 'google', providerAccountId: googleId },
      update: {},
    });

    const isSecure = process.env.NODE_ENV === 'production';
    const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token';
    const token = await encode({
      token: { sub: user.id, id: user.id, email: user.email, name: user.name ?? undefined },
      secret: process.env.AUTH_SECRET!,
      salt: cookieName,
      maxAge: MAX_AGE,
    });

    const response = NextResponse.json({
      ok: true, token, cookieName,
      user: { id: user.id, email: user.email, name: user.name },
    });
    response.cookies.set(cookieName, token, { httpOnly: true, secure: isSecure, sameSite: 'lax', path: '/', maxAge: MAX_AGE });
    return response;
  } catch (err) {
    console.error('[mobile-google-signin]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
