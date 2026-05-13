'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setStatus('error'); return; }
      setStatus('sent');
      // Dev-only: surface the reset link since there's no email provider configured yet
      if (data.resetUrl) setResetUrl(data.resetUrl);
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔑</div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Forgot Password</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {status === 'sent' ? (
          <div className="card text-center space-y-4">
            <div className="text-3xl">✉️</div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Check your email</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              If an account exists for <strong>{email}</strong>, a reset link has been sent. It expires in 1 hour.
            </p>
            {resetUrl && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 p-3 text-left">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-1">Dev mode — reset link:</p>
                <Link href={resetUrl} className="text-xs text-brand-600 dark:text-brand-400 break-all underline">
                  {resetUrl}
                </Link>
              </div>
            )}
            <Link href="/login" className="block text-sm text-brand-600 dark:text-brand-400 hover:underline mt-2">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4">
            {status === 'error' && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
                Something went wrong. Please try again.
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Email address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                className="input w-full"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="btn-primary w-full"
            >
              {status === 'loading' ? 'Sending…' : 'Send Reset Link'}
            </button>

            <p className="text-center text-xs text-slate-400 dark:text-slate-500">
              Remember your password?{' '}
              <Link href="/login" className="text-brand-600 dark:text-brand-400 hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
