import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    // Protect all app routes; allow public routes through
    '/((?!login|onboarding|forgot-password|reset-password|verify-email|api/auth|_next/static|_next/image|favicon.ico).*)',
    // Note: api/auth/* is excluded above, which covers api/auth/mobile-signin
  ],
};
