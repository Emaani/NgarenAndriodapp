/**
 * Live satellite tracking straight from Supabase `ceres_telemetry`, as the web
 * command centre's Track page does. Row-level security scopes both tables, so
 * an admin sees the portfolio and a farmer their own herd.
 *
 * No telemetry means an empty map, never made-up animals.
 */
import { supabase } from '../services/supabase';
import { reportDataFailure, reportDataSuccess } from '../services/dataHealth';
import { uuidToId } from '../lib/ids';
import { LineageLink, TELEMETRY_FEED_COLS, TelemetryRow, latestFixes, satelliteTags } from '../lib/liveFixes';
import { AnimalMarker } from './types';

const DAYS = 7;
const CHUNK = 100;

export async function getLineageLinks(): Promise<LineageLink[]> {
  const { data, error } = await supabase
    .from('animal_lineage')
    .select('id, animal_id, animal_name, animal_tag_id, visual_tag_number')
    .not('animal_tag_id', 'is', null);
  if (error) throw error;
  return (data ?? []) as LineageLink[];
}

async function telemetryFor(tags: string[], opts: { gpsOnly: boolean; limitPerTag: number; days: number }): Promise<TelemetryRow[]> {
  const since = new Date(Date.now() - opts.days * 86_400_000).toISOString();
  const out: TelemetryRow[] = [];
  for (let i = 0; i < tags.length; i += CHUNK) {
    const chunk = tags.slice(i, i + CHUNK);
    let q = supabase.from('ceres_telemetry').select(TELEMETRY_FEED_COLS).in('animal_tag_id', chunk).gte('recorded_at', since);
    if (opts.gpsOnly) q = q.not('latitude', 'is', null).not('longitude', 'is', null);
    const { data, error } = await q.order('recorded_at', { ascending: false }).limit(chunk.length * opts.limitPerTag);
    if (error) throw error;
    out.push(...((data ?? []) as TelemetryRow[]));
  }
  return out;
}

/** The latest position of every satellite-tagged animal in the last week. */
export async function getLiveAnimalLocations(): Promise<AnimalMarker[]> {
  try {
    const lineage = await getLineageLinks();
    const tags = satelliteTags(lineage);
    if (tags.length === 0) return [];
    const rows = await telemetryFor(tags, { gpsOnly: true, limitPerTag: 4, days: DAYS });
    reportDataSuccess();
    return latestFixes(lineage, rows);
  } catch (e) {
    reportDataFailure('live-tracking', e);
    return [];
  }
}

export interface LiveFeed {
  lineage: LineageLink[];
  rows: TelemetryRow[];
  tagsTracked: number;
}

/**
 * The most recent telemetry records (every kind: positions, activity, alerts,
 * summaries), newest first. `animalId` narrows it to one animal.
 */
export async function getLiveFeed(animalId?: number): Promise<LiveFeed> {
  try {
    const lineage = await getLineageLinks();
    const scoped = animalId === undefined ? lineage : lineage.filter((l) => uuidToId(l.id) === animalId);
    const tags = satelliteTags(scoped);
    if (tags.length === 0) return { lineage: scoped, rows: [], tagsTracked: 0 };
    const rows = await telemetryFor(tags, { gpsOnly: false, limitPerTag: animalId === undefined ? 5 : 100, days: DAYS });
    rows.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
    reportDataSuccess();
    return { lineage: scoped, rows: rows.slice(0, 200), tagsTracked: tags.length };
  } catch (e) {
    reportDataFailure('live-telemetry', e);
    return { lineage: [], rows: [], tagsTracked: 0 };
  }
}
