import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Receives crash/hang/performance diagnostics from the iOS app's MetricKit-based
 * CrashReportingService. This is intentionally lightweight (no dedicated DB table) —
 * reports are logged with a greppable prefix so they show up in Railway's log viewer/
 * alerting, giving basic crash visibility without standing up a third-party crash SDK.
 *
 * Accepts requests from both authenticated and unauthenticated app states (a crash can
 * happen before login), so this route is excluded from the auth middleware.
 */
export async function POST(req: NextRequest) {
  // Best-effort IP-based rate limit to prevent abuse from a misbehaving/looping client.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = rateLimit(`diagnostics:${ip}`, 30, 60 * 1000);
  if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // Best-effort: attach the user if there's a valid session, but never block on it.
  let userId: string | null = null;
  try {
    const session = await auth();
    userId = session?.user?.id ?? null;
  } catch {
    // ignore — diagnostics must never fail because auth() had trouble
  }

  const record = body as Record<string, unknown>;
  console.error(
    `[diagnostics] type=${record?.type ?? 'unknown'} user=${userId ?? 'anonymous'} ` +
      `appVersion=${record?.appVersion ?? '?'} build=${record?.buildNumber ?? '?'} ` +
      `payload=${JSON.stringify(record).slice(0, 4000)}`,
  );

  return NextResponse.json({ ok: true });
}
