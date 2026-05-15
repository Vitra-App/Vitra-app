'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (mode === 'register') {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Registration failed.');
        setLoading(false);
        return;
      }
      // Show "check your email" screen — don't auto-sign in
      setVerifyUrl(data.verifyUrl ?? null);
      setRegistered(true);
      setLoading(false);
      return;
    }

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid email or password. If you just registered, please verify your email first.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-white dark:from-slate-950 dark:to-slate-900 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="Vitra" width={140} height={140} className="mx-auto" priority />
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">AI-first nutrition tracking</p>
        </div>

        <div className="card">
          {registered ? (
            <div className="text-center py-2">
              <div className="text-4xl mb-3">📬</div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                Check your email
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                We sent a verification link to <strong>{email}</strong>. Click it to activate your account.
              </p>
              {verifyUrl && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3 mb-4 text-left">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Dev — verify link:</p>
                  <a
                    href={verifyUrl}
                    className="text-xs text-amber-600 dark:text-amber-300 underline break-all"
                  >
                    {verifyUrl}
                  </a>
                </div>
              )}
              <button
                className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
                onClick={() => { setRegistered(false); setMode('login'); }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
          <>
          {/* Tab switcher */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-700/50 p-1 mb-6">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition capitalize ${
                  mode === m ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label">Name</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={mode === 'register' ? 8 : 6}
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 rounded-lg bg-red-50 px-3 py-2">{error}</p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>

            {mode === 'login' && (
              <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                <Link href="/forgot-password" className="text-brand-600 dark:text-brand-400 hover:underline">
                  Forgot your password?
                </Link>
              </p>
            )}
          </form>

          {/* Demo shortcut */}
          <div className="mt-4 pt-4 border-t border-slate-100 text-center">
            <button
              className="text-xs text-slate-400 hover:text-brand-600"
              onClick={() => {
                setEmail('demo@vitra.app');
                setPassword('demo1234');
                setMode('login');
              }}
            >
              Use demo account
            </button>
          </div>
          </>
          )}
        </div>

        <p className="text-xs text-center text-slate-400 mt-6">
          By signing in you agree to our{' '}
          <Link href="#" className="underline hover:text-brand-600">Terms</Link>{' '}
          and{' '}
          <Link href="#" className="underline hover:text-brand-600">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
