import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { authConfig } from './auth.config';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          console.log('[authorize] credentials received:', { email: credentials?.email, passwordLen: (credentials?.password as string)?.length, passwordType: typeof credentials?.password });
          const parsed = loginSchema.safeParse(credentials);
          if (!parsed.success) {
            console.log('[authorize] zod failed:', JSON.stringify(parsed.error.issues));
            return null;
          }

          const { email, password } = parsed.data;
          const user = await prisma.user.findUnique({ where: { email } });
          console.log('[authorize] user:', !!user, 'hash:', !!user?.passwordHash);
          if (!user || !user.passwordHash) return null;

          const valid = await bcrypt.compare(password, user.passwordHash);
          console.log('[authorize] bcrypt:', valid, 'pw:', JSON.stringify(password));
          if (!valid) return null;

          return { id: user.id, email: user.email, name: user.name, image: user.image };
        } catch (err) {
          console.error('[authorize] error:', err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
});
