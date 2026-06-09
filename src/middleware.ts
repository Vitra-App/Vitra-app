import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    '/((?!login|onboarding|forgot-password|reset-password|verify-email|api/auth|api/admin|_next/static|_next/image|favicon.ico).*)',
  ],
};
