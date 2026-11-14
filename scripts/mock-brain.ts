/**
 * Tiny standalone mock of the backend "brain".
 * Replays green → yellow → red (SpO₂ 98 → 93 → 89, HR rising, radiation spike) at 1 tick/s, using the exact contract.
 *
 *   npm run mock-brain            # ws://localhost:8787
 *   NEXT_PUBLIC_BRAIN_WS_URL=ws://localhost:8787 npm run dev
 */
import { WebSocketServer } from 'ws';
import { scenarioTick } from '../src/lib/brainMock';

const port = Number(process.env.PORT ?? 8787);
const wss = new WebSocketServer({ port });
let i = 0;

setInterval(() => {
  const tick = scenarioTick(i++);
  const msg = JSON.stringify(tick);
  for (const c of wss.clients) if (c.readyState === 1) c.send(msg);
  process.stdout.write(`\rtick ${tick.seq} ${tick.alertLevel.padEnd(6)} SpO2 ${tick.rawVitals.spo2}%  HR ${tick.rawVitals.hr}  clients ${wss.clients.size}   `);
}, 1000);

console.log(`AstroCare mock brain on ws://localhost:${port}`);
