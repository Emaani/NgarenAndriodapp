/**
 * Telemetry analytics (Admin) — aggregates the last 7 days of Ceres Tag
 * telemetry from the SAME `ceres_telemetry` table as the web
 * TelemetryAnalyticsPage, so RLS scopes rows per role automatically.
 *
 * Degrades gracefully: when Supabase isn't configured or the query errors, it
 * returns a representative mock so the screen stays usable in Demo Mode.
 */
import { supabase } from '../services/supabase';
import { isSupabaseConfigured } from '../config';

export interface BehaviourSlice {
  label: string;
  value: number;
}

export interface TagBattery {
  tag: string;
  battery: number;
}

export interface TelemetrySummary {
  pings: number;
  activeTags: number;
  avgActivity: number; // 0–100
  lowBattery: number;
  activityByDay: number[]; // avg activity per day, oldest → newest (7 pts)
  behaviour: BehaviourSlice[];
  batteries: TagBattery[]; // lowest battery first
}

interface TelemetryRow {
  animal_tag_id: string | null;
  recorded_at: string | null;
  activity_level: number | null;
  behaviour: string | null;
  battery_pct: number | null;
}

export const MOCK: TelemetrySummary = {
  pings: 1284,
  activeTags: 42,
  avgActivity: 63,
  lowBattery: 3,
  activityByDay: [58, 61, 55, 67, 64, 70, 66],
  behaviour: [
    { label: 'Grazing', value: 46 },
    { label: 'Resting', value: 31 },
    { label: 'Walking', value: 15 },
    { label: 'Ruminating', value: 8 },
  ],
  batteries: [
    { tag: 'A-008', battery: 12 },
    { tag: 'A-061', battery: 18 },
    { tag: 'A-042', battery: 24 },
    { tag: 'A-073', battery: 55 },
    { tag: 'A-090', battery: 81 },
  ],
};

function aggregate(rows: TelemetryRow[]): TelemetrySummary {
  if (rows.length === 0) return { ...MOCK, pings: 0, activeTags: 0, avgActivity: 0, lowBattery: 0 };

  const tags = new Set<string>();
  const activityVals: number[] = [];
  const behaviourCounts: Record<string, number> = {};
  const latestBattery: Record<string, { at: number; pct: number }> = {};

  // Bucket activity into 7 day-slots relative to now.
  const dayBuckets: { sum: number; n: number }[] = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
  const now = Date.now();

  for (const r of rows) {
    if (r.animal_tag_id) tags.add(r.animal_tag_id);
    if (typeof r.activity_level === 'number') {
      activityVals.push(r.activity_level);
      const t = r.recorded_at ? new Date(r.recorded_at).getTime() : now;
      const daysAgo = Math.min(6, Math.max(0, Math.floor((now - t) / 86_400_000)));
      const idx = 6 - daysAgo; // oldest → newest
      dayBuckets[idx].sum += r.activity_level;
      dayBuckets[idx].n += 1;
    }
    if (r.behaviour) behaviourCounts[r.behaviour] = (behaviourCounts[r.behaviour] ?? 0) + 1;
    if (r.animal_tag_id && typeof r.battery_pct === 'number') {
      const at = r.recorded_at ? new Date(r.recorded_at).getTime() : now;
      const prev = latestBattery[r.animal_tag_id];
      if (!prev || at > prev.at) latestBattery[r.animal_tag_id] = { at, pct: r.battery_pct };
    }
  }

  const avg = activityVals.length ? Math.round(activityVals.reduce((a, b) => a + b, 0) / activityVals.length) : 0;
  const batteries = Object.entries(latestBattery)
    .map(([tag, v]) => ({ tag, battery: Math.round(v.pct) }))
    .sort((a, b) => a.battery - b.battery);

  return {
    pings: rows.length,
    activeTags: tags.size,
    avgActivity: avg,
    lowBattery: batteries.filter((b) => b.battery < 20).length,
    activityByDay: dayBuckets.map((d) => (d.n ? Math.round(d.sum / d.n) : 0)),
    behaviour: Object.entries(behaviourCounts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
    batteries,
  };
}

export async function getTelemetryAnalytics(): Promise<TelemetrySummary> {
  if (!isSupabaseConfigured()) return MOCK;
  try {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from('ceres_telemetry')
      .select('animal_tag_id, recorded_at, activity_level, behaviour, battery_pct')
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: false })
      .limit(2000);
    if (error || !data) return MOCK;
    return aggregate(data as TelemetryRow[]);
  } catch {
    return MOCK;
  }
}
