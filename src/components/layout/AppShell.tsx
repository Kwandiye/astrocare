'use client';
import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useHealthStore, type View } from '@/store/useHealthStore';
import { useDashboard } from '@/hooks/useDashboard';
import { useDemo } from '@/hooks/useDemo';
import { TopBar } from './TopBar';
import { BrainConnector } from './BrainConnector';
import { WhatIfDrawer } from './WhatIfDrawer';
import { Overview } from '@/components/overview/Overview';
import { Drawers } from '@/components/overview/Drawers';
import { AnalyticsView } from '@/components/views/AnalyticsView';
import { AssistantView } from '@/components/views/AssistantView';
import { TrainingView } from '@/components/views/TrainingView';
import { HistoryView } from '@/components/views/HistoryView';
import { CheckIn } from '@/components/checkin/CheckIn';
import { CrewView } from '@/components/views/CrewView';
import { RiskRadar } from '@/components/views/RiskRadar';
import { LearnView } from '@/components/views/LearnView';
import { DISCLAIMER } from '@/lib/protocols';

export function AppShell({ initialView }: { initialView?: View }) {
  const view = useHealthStore((s) => s.view);
  const checkinOpen = useHealthStore((s) => s.checkinOpen);
  const whatIfOpen = useHealthStore((s) => s.whatIfOpen);
  const mode = useHealthStore((s) => s.mode);
  const set = useHealthStore((s) => s.set);
  const demo = useDemo();
  const d = useDashboard();

  useEffect(() => { if (initialView) set({ view: initialView }); }, [initialView, set]);
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [view]);

  return (
    <div className="min-h-screen">
      <BrainConnector />
      <TopBar onDemo={demo.toggle} />
      <main className="mx-auto max-w-[1680px] px-4 pb-6 pt-4">
        <AnimatePresence>{whatIfOpen && <WhatIfDrawer />}</AnimatePresence>
        {view === 'dashboard' && <Overview d={d} />}
        {view === 'analytics' && <AnalyticsView d={d} />}
        {view === 'assistant' && <AssistantView d={d} />}
        {(view === 'training' || view === 'routine') && <TrainingView d={d} />}
        {view === 'history' && <HistoryView d={d} />}
        {view === 'crew' && <CrewView />}
        {view === 'radar' && <RiskRadar />}
        {view === 'learn' && <LearnView />}
        <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-slate-500">
          <span>{DISCLAIMER}</span>
          <span>Thresholds: NASA-STD-3001, OCHMO-TB-004, NASA HRP.</span>
          <span>3D anatomy: <a className="underline hover:text-slate-300" href="https://www.z-anatomy.com" target="_blank" rel="noreferrer">Z-Anatomy</a> / BodyParts3D, CC BY-SA 4.0.</span>
          <span className={mode === 'mock' ? 'text-warn/80' : ''}>{mode === 'mock' ? 'Demo data — synthetic, not real patient measurements.' : 'Live data from the onboard brain.'}</span>
        </footer>
      </main>
      <Drawers d={d} />
      <AnimatePresence>{checkinOpen && <CheckIn />}</AnimatePresence>
    </div>
  );
}
