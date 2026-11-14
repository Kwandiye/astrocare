import type { BrainFlag } from '@/types/brain';
import type { ZoneId } from '@/types/health';

/** Zone for a brain flag: flag.zone if present, otherwise a mapping from metric/type. */
export function zoneForFlag(f: BrainFlag): ZoneId {
  if (f.zone) return f.zone;
  const m = (f.metric ?? '').toLowerCase();
  if (/^(hr|bp|bp_sys|bp_dia|sbp|dbp|hrv)/.test(m)) return 'heart';
  if (/(spo2|resp|co2)/.test(m)) return 'lungs';
  if (/temp/.test(m)) return 'skin_immune';
  if (/glucose/.test(m)) return 'pancreas';
  switch (f.type) {
    case 'sleep': case 'mood': return 'brain';
    case 'nutrition': return 'stomach_gi';
    case 'exercise': return 'muscles_legs';
    case 'radiation': return 'skin_immune';
    default: return 'heart';
  }
}
