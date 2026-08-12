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
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;
      // /api/admin/* routes bypass session-based auth here because they enforce
      // their own secret-based check (see ADMIN_SEED_SECRET in seed-foods/route.ts).
      // Do NOT add new /api/admin routes without an equivalent explicit auth check.
      if (pathname.startsWith('/api/admin')) return true;
      return !!auth?.user;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
