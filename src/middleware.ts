import { NextRequest, NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

const { auth } = NextAuth(authConfig);

export async function middleware(request: NextRequest) {
  // Allow admin routes through without auth
  if (request.nextUrl.pathname.startsWith('/api/admin')) {
    return NextResponse.next();
  }
  // Use NextAuth for all other protected routes
  return (auth as any)(request);
}

export const config = {
  matcher: [
    '/((?!login|onboarding|forgot-password|reset-password|verify-email|api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
