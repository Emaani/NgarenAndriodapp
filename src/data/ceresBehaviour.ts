/**
 * Live Ceres Tag behaviour series, read directly from the Supabase
 * `ceres_telemetry` table (the same source the web Telemetry analytics uses).
 *
 * This replaces the platform-api `getAnimalBehaviour`, which returned synthetic
 * mock data because the platform URL isn't configured. Honesty rules:
 *   - Backend not configured (local/demo): return mock so the demo still shows
 *     charts.
 *   - Configured + query error: signal a data failure (the offline/stale
 *     banner) and return [] so the screen shows its "no live data" state rather
 *     than fabricated numbers.
 *   - Configured + success: return real daily-aggregated series (or [] when the
 *     animal has no telemetry) — never mock presented as live.
 */
import { supabase } from '../services/supabase';
import { isSupabaseConfigured } from '../config';
import { reportDataFailure, reportDataSuccess } from '../services/dataHealth';
import { BehaviourSeries } from './types';
import { behaviourSeries as MOCK } from './mock';

const DAYS = 14;

interface Row {
  animal_tag_id: string | null;
  recorded_at: string | null;
  activity_level: number | null;
  feed_intake_kg: number | null;
  methane_g: number | null;
}

/** Average a metric into DAYS daily buckets, oldest → newest. */
function dailyAvg(rows: Row[], pick: (r: Row) => number | null): number[] {
  const buckets = Array.from({ length: DAYS }, () => ({ sum: 0, n: 0 }));
  const now = Date.now();
  for (const r of rows) {
    const v = pick(r);
    if (typeof v !== 'number') continue;
    const t = r.recorded_at ? new Date(r.recorded_at).getTime() : now;
    const daysAgo = Math.min(DAYS - 1, Math.max(0, Math.floor((now - t) / 86_400_000)));
    buckets[DAYS - 1 - daysAgo].sum += v;
    buckets[DAYS - 1 - daysAgo].n += 1;
  }
  return buckets.map((b) => (b.n ? Math.round((b.sum / b.n) * 10) / 10 : 0));
}

/**
 * @param keys candidate tag identifiers to match `animal_tag_id` (e.g. device
 *   serial / tag / Ngaren code). Omit for a herd-wide aggregate.
 */
export async function getCeresBehaviour(keys?: string[]): Promise<BehaviourSeries[]> {
  if (!isSupabaseConfigured()) return MOCK; // demo mode keeps the charts populated
  try {
    const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
    let q = supabase
      .from('ceres_telemetry')
      .select('animal_tag_id, recorded_at, activity_level, feed_intake_kg, methane_g')
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true })
      .limit(5000);
    const filterKeys = (keys ?? []).filter(Boolean);
    if (filterKeys.length) q = q.in('animal_tag_id', filterKeys);

    const { data, error } = await q;
    if (error) {
      reportDataFailure('ceres-behaviour', error);
      return []; // couldn't confirm live data — show the "no data" state, not mock
    }
    reportDataSuccess();
    const rows = (data ?? []) as Row[];

    const series: BehaviourSeries[] = [];
    const add = (label: string, unit: string, pick: (r: Row) => number | null) => {
      if (rows.some((r) => typeof pick(r) === 'number')) {
        series.push({ label, unit, actual: dailyAvg(rows, pick), pfi: [] });
      }
    };
    add('Activity Level', 'level', (r) => r.activity_level);
    add('Feed Intake', 'kg/day', (r) => r.feed_intake_kg);
    add('Methane Production', 'g/day', (r) => r.methane_g);
    return series; // [] when the animal/herd has no telemetry yet — honest empty
  } catch (e) {
    reportDataFailure('ceres-behaviour', e);
    return [];
  }
}
