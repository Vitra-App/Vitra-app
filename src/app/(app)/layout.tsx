import { redirect } from 'next/navigation';
import { MobileNav } from '@/components/layout/Sidebar';
import { getSession } from '@/lib/session';
import Image from 'next/image';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen bg-slate-200 dark:bg-slate-900 flex justify-center">
      <div className="w-full max-w-[430px] bg-white dark:bg-slate-950 min-h-screen flex flex-col shadow-2xl relative">
        {/* Top header bar */}
        <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800/60 px-4 py-3 flex items-center justify-center">
          <Image src="/logo.png" alt="Vitra" width={72} height={28} className="object-contain" />
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 pt-4 pb-28">
          {children}
        </main>

        <MobileNav />
      </div>
    </div>
  );
}
