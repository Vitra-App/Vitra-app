'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { VitraLogo } from '@/components/VitraLogo';

function VerifyContent() {
  const params = useSearchParams();
  const verified = params.get('verified') === '1';
  const error = params.get('error');

  const errorMessages: Record<string, string> = {
    missing: 'No verification token was provided.',
    invalid: 'This verification link is invalid or has already been used.',
    expired: 'This verification link has expired. Please register again.',
  };

  return (
    <div className="text-center">
      {verified ? (
        <>
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Email verified!
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Your account is now active. You can sign in.
          </p>
          <Link href="/login" className="btn-primary">
            Sign In
          </Link>
        </>
      ) : (
        <>
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Verification failed
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            {errorMessages[error ?? ''] ?? 'Something went wrong. Please try again.'}
          </p>
          <Link href="/login" className="btn-primary">
            Back to Sign In
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-white dark:from-slate-950 dark:to-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <VitraLogo size="lg" className="mb-2" />
        </div>
        <div className="card">
          <Suspense fallback={<p className="text-center text-slate-500">Loading…</p>}>
            <VerifyContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
