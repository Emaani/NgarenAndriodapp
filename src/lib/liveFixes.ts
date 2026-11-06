/**
 * Live satellite positions from `ceres_telemetry`, the table the web command
 * centre's Track page reads. Rows are keyed by `animal_tag_id`; an animal is
 * linked to its tag through `animal_lineage.animal_tag_id`.
 *
 * Pure so it can be tested without Supabase: the data layer fetches, this
 * turns rows into map markers and feed entries.
 */
import { AnimalMarker } from '@/data/types';
import { uuidToId } from './ids';

export interface LineageLink {
  id: string;
  animal_id: string | null;
  animal_name: string | null;
  animal_tag_id: string | null;
  visual_tag_number: string | null;
}

export interface TelemetryRow {
  animal_tag_id: string;
  record_type: string;
  recorded_at: string;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy_m: number | null;
  location_accuracy_label: string | null;
  temperature_celsius: number | null;
  battery_pct: number | null;
  activity_level: number | null;
  activity_label: string | null;
  behaviour: string | null;
  confidence_label: string | null;
}

export const TELEMETRY_FEED_COLS =
  'animal_tag_id, record_type, recorded_at, latitude, longitude, gps_accuracy_m, location_accuracy_label, temperature_celsius, battery_pct, activity_level, activity_label, behaviour, confidence_label';

/** A fix is live when it is under a day old; older ones show grey. */
export const LIVE_WINDOW_MINS = 24 * 60;

// A Bluetooth tag (colon MAC) never reports by satellite, so it is no use asking.
const COLON_MAC = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i;

/** The satellite tags worth querying for. */
export function satelliteTags(lineage: LineageLink[]): string[] {
  const tags = lineage.map((l) => l.animal_tag_id?.trim()).filter((t): t is string => !!t && !COLON_MAC.test(t));
  return [...new Set(tags)];
}

export function accuracyOf(r: Pick<TelemetryRow, 'gps_accuracy_m' | 'location_accuracy_label'>): AnimalMarker['accuracy'] {
  if (typeof r.gps_accuracy_m === 'number') return r.gps_accuracy_m <= 30 ? 'Good' : r.gps_accuracy_m <= 100 ? 'Fair' : 'Poor';
  const label = r.location_accuracy_label ?? '';
  if (/good|high|excellent/i.test(label)) return 'Good';
  if (/poor|low|bad/i.test(label)) return 'Poor';
  // Unknown accuracy is shown as fair, never as good.
  return 'Fair';
}

export function minutesAgo(iso: string, now = Date.now()): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, Math.round((now - t) / 60_000)) : 0;
}

/** How the animal is named on the map: its visual tag, then its name, then its AAN. */
export function animalLabel(l: LineageLink): string {
  return l.visual_tag_number || l.animal_name || l.animal_id || l.animal_tag_id || '-';
}

/** The latest fix per animal, as map markers. Rows may come in any order. */
export function latestFixes(lineage: LineageLink[], rows: TelemetryRow[], now = Date.now()): AnimalMarker[] {
  const byTag = new Map<string, LineageLink>();
  for (const l of lineage) if (l.animal_tag_id) byTag.set(l.animal_tag_id.trim(), l);

  const latest = new Map<string, TelemetryRow>();
  for (const r of rows) {
    if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number') continue;
    if (r.latitude === 0 && r.longitude === 0) continue; // no fix, not the Gulf of Guinea
    const prev = latest.get(r.animal_tag_id);
    if (!prev || new Date(r.recorded_at).getTime() > new Date(prev.recorded_at).getTime()) latest.set(r.animal_tag_id, r);
  }

  const markers: AnimalMarker[] = [];
  for (const [tag, r] of latest) {
    const l = byTag.get(tag);
    if (!l) continue;
    const mins = minutesAgo(r.recorded_at, now);
    markers.push({
      animalId: uuidToId(l.id),
      tag: animalLabel(l),
      lat: r.latitude as number,
      lng: r.longitude as number,
      accuracy: accuracyOf(r),
      lastSeenMins: mins,
      status: mins <= LIVE_WINDOW_MINS ? 'active' : 'inactive',
      provider: 'Ceres Tag',
      keys: [l.id, l.animal_id, l.animal_tag_id, l.visual_tag_number].filter((k): k is string => !!k),
      recordedAt: r.recorded_at,
      batteryPct: r.battery_pct,
    });
  }
  return markers.sort((a, b) => a.lastSeenMins - b.lastSeenMins);
}

/** What one telemetry record says, in a line, for the live feed. */
export function feedSummary(r: TelemetryRow): { kind: 'position' | 'activity' | 'alert' | 'summary' | 'other'; parts: string[] } {
  const parts: string[] = [];
  if (typeof r.latitude === 'number' && typeof r.longitude === 'number' && !(r.latitude === 0 && r.longitude === 0)) {
    parts.push(`${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}${typeof r.gps_accuracy_m === 'number' ? ` ±${Math.round(r.gps_accuracy_m)} m` : ''}`);
  }
  if (typeof r.temperature_celsius === 'number') parts.push(`${r.temperature_celsius.toFixed(1)} °C`);
  if (typeof r.battery_pct === 'number') parts.push(`${Math.round(r.battery_pct)}%`);
  // The descriptive label is what CERES asks apps to show, not the 0–7 number.
  if (r.activity_label) parts.push(r.activity_label);
  if (r.behaviour) parts.push(r.behaviour + (r.confidence_label ? ` (${r.confidence_label})` : ''));

  const t = r.record_type;
  const kind = t === 'standard' || t === 'historical' ? 'position' : t === 'activity' ? 'activity' : t === 'alert' || t === 'repro' ? 'alert' : t === 'pfi' ? 'summary' : 'other';
  return { kind, parts };
}
