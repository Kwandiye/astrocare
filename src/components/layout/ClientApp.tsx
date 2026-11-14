'use client';
import dynamic from 'next/dynamic';
import type { View } from '@/store/useHealthStore';

/** The whole app is client-side (offline, live clock, persisted local state) → no SSR hydration mismatches. */
const AppShell = dynamic(() => import('./AppShell').then((m) => m.AppShell), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sky-300">
      <div className="h-16 w-16 animate-spin rounded-full border-2 border-sky-400/20 border-t-sky-400" />
      <div className="text-sm tracking-wider">Assembling the digital twin…</div>
    </div>
  ),
});

export function ClientApp({ initialView }: { initialView?: View }) {
  return <AppShell initialView={initialView} />;
}
