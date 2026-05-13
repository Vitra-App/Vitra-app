import type { NextAuthConfig } from 'next-auth';

/**
 * Minimal auth config for the Edge middleware.
 * Must NOT import bcryptjs, Prisma, or any Node.js-only modules.
 * Only used to verify the JWT and enforce route protection.
 */
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
    newUser: '/onboarding',
  },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
