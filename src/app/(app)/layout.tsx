import { redirect } from 'next/navigation';
import { MobileNav } from '@/components/layout/Sidebar';
import { getSession } from '@/lib/session';
import { VitraLogo } from '@/components/VitraLogo';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="h-screen w-full flex justify-center bg-slate-200 dark:bg-slate-900 overflow-hidden">
      <div className="w-full max-w-[430px] bg-white dark:bg-slate-950 h-full flex flex-col shadow-2xl relative overflow-hidden">
        {/* Top header bar */}
        <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800/60 px-4 py-3 flex items-center justify-center shrink-0">
          <VitraLogo size="sm" />
        </header>

        {/* Page content is the dedicated scroll container.
            iOS standalone/PWA mode does not reliably scroll the document body,
            so the scrollable area must be an explicit overflow-y-auto element. */}
        <main
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-28"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </main>

        <MobileNav />
      </div>
    </div>
  );
}
