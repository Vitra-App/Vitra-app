import { NextRequest, NextResponse } from 'next/server';
import { encode } from '@auth/core/jwt';
import { prisma } from '@/lib/prisma';
import appleSignin from 'apple-signin-auth';

const MAX_AGE = 30 * 24 * 60 * 60;

export async function POST(req: NextRequest) {
  try {
    const { identityToken, appleUserId, email, fullName } = await req.json();

    if (!identityToken || !appleUserId) {
      return NextResponse.json({ error: 'identityToken and appleUserId required' }, { status: 400 });
    }

    // Verify Apple identity token
    let applePayload: { sub?: string; email?: string };
    try {
      applePayload = await appleSignin.verifyIdToken(identityToken, {
        audience: process.env.APPLE_CLIENT_ID ?? 'com.michaelalexandrou.vitra',
        ignoreExpiration: false,
      });
    } catch {
      return NextResponse.json({ error: 'Invalid Apple identity token' }, { status: 401 });
    }

    const verifiedAppleId = applePayload.sub ?? appleUserId;
    const appleEmail = applePayload.email ?? email;

    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        accounts: { some: { provider: 'apple', providerAccountId: verifiedAppleId } },
      },
    });

    if (!user && appleEmail) {
      // Check if email already exists (link accounts)
      user = await prisma.user.findUnique({ where: { email: appleEmail } });
    }

    if (!user) {
      // Create new user
      const name = fullName ?? appleEmail?.split('@')[0] ?? 'Vitra User';
      user = await prisma.user.create({
        data: {
          email: appleEmail ?? `apple_${verifiedAppleId}@private.vitra.app`,
          name,
          emailVerified: new Date(),
        },
      });
    }

    // Upsert the Apple account link
    await prisma.account.upsert({
      where: { provider_providerAccountId: { provider: 'apple', providerAccountId: verifiedAppleId } },
      create: { userId: user.id, type: 'oauth', provider: 'apple', providerAccountId: verifiedAppleId },
      update: {},
    });

    // Issue session token
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
    console.error('[mobile-apple-signin]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
