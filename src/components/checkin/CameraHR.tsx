'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, FlaskConical } from 'lucide-react';

/**
 * EXPERIMENTAL remote photoplethysmography (rPPG): average green channel of the forehead region over 20 s,
 * detrend, then a discrete Fourier scan over 0.75–3.0 Hz (45–180 bpm). Runs fully on-device.
 */
export function CameraHR({ onResult }: { onResult: (bpm: number) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [bpm, setBpm] = useState<number | null>(null);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  const start = async () => {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } });
      const v = video.current!;
      v.srcObject = stream.current;
      await v.play();
      setState('running');
      const ctx = canvas.current!.getContext('2d', { willReadFrequently: true })!;
      const samples: { t: number; g: number }[] = [];
      const t0 = performance.now();
      const DURATION = 20000;
      const loop = () => {
        const now = performance.now();
        ctx.drawImage(v, 0, 0, 160, 120);
        // forehead ROI: centre-top of the frame
        const img = ctx.getImageData(56, 18, 48, 22).data;
        let g = 0;
        for (let i = 1; i < img.length; i += 4) g += img[i];
        samples.push({ t: (now - t0) / 1000, g: g / (img.length / 4) });
        setProgress(Math.min(1, (now - t0) / DURATION));
        if (now - t0 < DURATION) requestAnimationFrame(loop);
        else finish(samples);
      };
      requestAnimationFrame(loop);
    } catch {
      setState('error');
    }
  };

  const finish = (s: { t: number; g: number }[]) => {
    stream.current?.getTracks().forEach((t) => t.stop());
    // detrend with a 1-s moving average
    const win = Math.max(3, Math.round(s.length / 20));
    const x = s.map((p, i) => {
      const lo = Math.max(0, i - win), hi = Math.min(s.length, i + win);
      let m = 0;
      for (let j = lo; j < hi; j++) m += s[j].g;
      return p.g - m / (hi - lo);
    });
    let best = 0, bestF = 1.2;
    for (let f = 0.75; f <= 3.0; f += 0.01) {
      let re = 0, im = 0;
      for (let i = 0; i < x.length; i++) { const a = 2 * Math.PI * f * s[i].t; re += x[i] * Math.cos(a); im += x[i] * Math.sin(a); }
      const p = re * re + im * im;
      if (p > best) { best = p; bestF = f; }
    }
    const r = Math.round(bestF * 60);
    setBpm(r);
    setState('done');
    onResult(r);
  };

  return (
    <div className="rounded-lg border border-dashed border-slate-600 p-3 text-xs">
      <div className="mb-1 flex items-center gap-1.5 font-semibold text-slate-200"><FlaskConical size={13} className="text-amber-300" /> Webcam heart rate <span className="rounded bg-amber-500/15 px-1 text-[10px] text-amber-300">experimental</span></div>
      <p className="mb-2 text-slate-400">Keep your face still in good light for 20 s. Video never leaves this device.</p>
      <div className="flex items-center gap-3">
        <video ref={video} muted playsInline className={`h-20 w-28 rounded bg-black object-cover ${state === 'running' ? '' : 'hidden'}`} />
        <canvas ref={canvas} width={160} height={120} className="hidden" />
        {state === 'idle' || state === 'error' ? (
          <button onClick={start} className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 hover:bg-slate-700"><Camera size={13} /> Start 20 s measurement</button>
        ) : state === 'running' ? (
          <div className="flex-1"><div className="h-1.5 rounded bg-slate-800"><div className="h-full rounded bg-sky-400" style={{ width: `${progress * 100}%` }} /></div><div className="mt-1 text-slate-400">Measuring… {Math.round(progress * 20)} s</div></div>
        ) : (
          <div className="num text-lg font-bold text-sky-200">{bpm} bpm <span className="text-xs font-normal text-slate-400">(camera estimate)</span></div>
        )}
      </div>
      {state === 'error' && <p className="mt-1 text-red-300">Camera not available or permission denied.</p>}
    </div>
  );
}
