import { NextRequest, NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

const { auth } = NextAuth(authConfig);

export async function middleware(request: NextRequest) {
  // Allow admin routes through without auth
  if (request.nextUrl.pathname.startsWith('/api/admin')) {
    return NextResponse.next();
  }
  // Crash/diagnostic reports must be accepted even from unauthenticated or
  // pre-login app states (e.g. a crash on the login screen itself).
  if (request.nextUrl.pathname.startsWith('/api/diagnostics')) {
    return NextResponse.next();
  }
  // Use NextAuth for all other protected routes
  return (auth as any)(request);
}

export const config = {
  matcher: [
    '/((?!login|onboarding|forgot-password|reset-password|verify-email|api/auth|api/diagnostics|_next/static|_next/image|favicon.ico).*)',
  ],
};
