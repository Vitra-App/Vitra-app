'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setErrorMsg('Passwords do not match.'); return; }
    if (password.length < 8) { setErrorMsg('Password must be at least 8 characters.'); return; }
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error || 'Something went wrong.'); setStatus('error'); return; }
      setStatus('success');
      setTimeout(() => router.push('/login'), 2500);
    } catch {
      setErrorMsg('Something went wrong. Please try again.');
      setStatus('error');
    }
  }

  if (!token) {
    return (
      <div className="card text-center space-y-3">
        <p className="text-sm text-red-600 font-medium">Invalid or missing reset token.</p>
        <Link href="/forgot-password" className="text-sm text-brand-600 dark:text-brand-400 hover:underline">
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="card text-center space-y-3">
        <div className="text-3xl">✅</div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Password updated!</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Redirecting you to sign in…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      {(status === 'error' || errorMsg) && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
          New password
        </label>
        <input
          type="password"
          required
          autoComplete="new-password"
          className="input w-full"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
          Confirm new password
        </label>
        <input
          type="password"
          required
          autoComplete="new-password"
          className="input w-full"
          placeholder="Repeat your password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      <button type="submit" disabled={status === 'loading'} className="btn-primary w-full">
        {status === 'loading' ? 'Updating…' : 'Set New Password'}
      </button>

      <p className="text-center text-xs text-slate-400 dark:text-slate-500">
        <Link href="/login" className="text-brand-600 dark:text-brand-400 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔒</div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Set New Password</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Choose a strong password for your account.</p>
        </div>
        <Suspense fallback={<div className="card text-center text-sm text-slate-400">Loading…</div>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
