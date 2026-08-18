/**
 * Live Ceres Tag behaviour series, read directly from Supabase `ceres_telemetry`
 * and aligned to the authoritative CERES schema used by the web command centre
 * (AnimalDetailPage / TelemetryAnalyticsPage):
 *
 *   - Telemetry is keyed by `animal_tag_id` (the CERES tag). An app animal is
 *     linked to it via `animal_lineage` — we resolve the animal's candidate
 *     identifiers to the real `animal_tag_id` first.
 *   - Data is split by `record_type`. The behaviour minutes + DMI + methane come
 *     from PFI-summary records (`record_type = 'pfi'`, columns grazing_mins,
 *     ruminating_mins, walking_mins, resting_mins, drinking_unclassified_mins,
 *     resting_and_ruminating_mins, dry_matter_intake_kg_per_day, methane_g).
 *     The activity intensity (0–7) comes from activity records
 *     (`record_type = 'activity'`, column activity_level).
 *
 * Honesty: configured + no matching telemetry → returns [] (the screen shows a
 * "no live data" state). Only pure demo mode (no backend) returns mock.
 */
import { supabase } from '../services/supabase';
import { isSupabaseConfigured } from '../config';
import { reportDataFailure, reportDataSuccess } from '../services/dataHealth';
import { BehaviourSeries } from './types';
import { behaviourSeries as MOCK } from './mock';

const DAYS = 14;

interface Row {
  animal_tag_id: string | null;
  record_type: string | null;
  recorded_at: string | null;
  grazing_mins: number | null;
  ruminating_mins: number | null;
  walking_mins: number | null;
  resting_mins: number | null;
  drinking_unclassified_mins: number | null;
  resting_and_ruminating_mins: number | null;
  dry_matter_intake_kg_per_day: number | null;
  methane_g: number | null;
  activity_level: number | null;
}

const TELEMETRY_COLS =
  'animal_tag_id, record_type, recorded_at, grazing_mins, ruminating_mins, walking_mins, resting_mins, drinking_unclassified_mins, resting_and_ruminating_mins, dry_matter_intake_kg_per_day, methane_g, activity_level';

// PFI-summary behaviour series, in the order the web presents them.
const PFI_SERIES: { label: string; unit: string; pick: (r: Row) => number | null }[] = [
  { label: 'Grazing', unit: 'min/day', pick: (r) => r.grazing_mins },
  { label: 'Ruminating', unit: 'min/day', pick: (r) => r.ruminating_mins },
  { label: 'Walking', unit: 'min/day', pick: (r) => r.walking_mins },
  { label: 'Resting', unit: 'min/day', pick: (r) => r.resting_mins },
  { label: 'Resting & Ruminating', unit: 'min/day', pick: (r) => r.resting_and_ruminating_mins },
  { label: 'Drinking & Other', unit: 'min/day', pick: (r) => r.drinking_unclassified_mins },
  { label: 'Dry Matter Intake', unit: 'kg/day', pick: (r) => r.dry_matter_intake_kg_per_day },
  { label: 'Methane Production', unit: 'g/day', pick: (r) => r.methane_g },
];

/** Average a metric into DAYS daily buckets, oldest → newest. */
function dailyAvg(rows: Row[], pick: (r: Row) => number | null): { series: number[]; has: boolean } {
  const buckets = Array.from({ length: DAYS }, () => ({ sum: 0, n: 0 }));
  const now = Date.now();
  let has = false;
  for (const r of rows) {
    const v = pick(r);
    if (typeof v !== 'number') continue;
    has = true;
    const t = r.recorded_at ? new Date(r.recorded_at).getTime() : now;
    const daysAgo = Math.min(DAYS - 1, Math.max(0, Math.floor((now - t) / 86_400_000)));
    buckets[DAYS - 1 - daysAgo].sum += v;
    buckets[DAYS - 1 - daysAgo].n += 1;
  }
  return { series: buckets.map((b) => (b.n ? Math.round((b.sum / b.n) * 10) / 10 : 0)), has };
}

/**
 * Resolve an app animal's candidate identifiers to the real CERES `animal_tag_id`
 * via animal_lineage (matching the tag stored there, or the visual tag number).
 * Falls back to the raw candidates so a direct tag match still works.
 */
async function resolveTagIds(keys: string[]): Promise<string[]> {
  if (keys.length === 0) return [];
  try {
    const [byTag, byVisual] = await Promise.all([
      supabase.from('animal_lineage').select('animal_tag_id').in('animal_tag_id', keys),
      supabase.from('animal_lineage').select('animal_tag_id').in('visual_tag_number', keys),
    ]);
    const resolved = [...(byTag.data ?? []), ...(byVisual.data ?? [])]
      .map((r) => (r as { animal_tag_id: string | null }).animal_tag_id)
      .filter((t): t is string => !!t);
    return Array.from(new Set([...keys, ...resolved]));
  } catch {
    return keys;
  }
}

/**
 * @param keys candidate identifiers of ONE animal (device serial / tag / Ngaren
 *   code / visual number). Omit for a herd-wide aggregate.
 */
export async function getCeresBehaviour(keys?: string[]): Promise<BehaviourSeries[]> {
  if (!isSupabaseConfigured()) return MOCK; // demo mode keeps the charts populated
  try {
    const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
    const tagIds = keys ? await resolveTagIds(keys.filter(Boolean)) : null;

    let q = supabase
      .from('ceres_telemetry')
      .select(TELEMETRY_COLS)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true })
      .limit(5000);
    if (tagIds) {
      if (tagIds.length === 0) return []; // an animal with no resolvable tag has no telemetry
      q = q.in('animal_tag_id', tagIds);
    }

    const { data, error } = await q;
    if (error) {
      reportDataFailure('ceres-behaviour', error);
      return []; // couldn't confirm live data — honest empty, not mock
    }
    reportDataSuccess();
    const rows = (data ?? []) as Row[];

    const pfiRows = rows.filter((r) => r.record_type === 'pfi');
    const activityRows = rows.filter((r) => r.record_type === 'activity' || r.record_type === 'standard');

    const series: BehaviourSeries[] = [];
    for (const def of PFI_SERIES) {
      const { series: actual, has } = dailyAvg(pfiRows, def.pick);
      if (has) series.push({ label: def.label, unit: def.unit, actual, pfi: [] });
    }
    const activity = dailyAvg(activityRows, (r) => r.activity_level);
    if (activity.has) series.push({ label: 'Activity Intensity', unit: '0–7', actual: activity.series, pfi: [] });

    return series; // [] when this animal/herd has no telemetry yet — honest empty
  } catch (e) {
    reportDataFailure('ceres-behaviour', e);
    return [];
  }
}
