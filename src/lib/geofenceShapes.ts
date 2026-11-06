/**
 * The shared `geofences` table, as the web command centre writes it
 * (drizzle/migrations/0007_create_geofences.sql in livestock-command-center).
 *
 * Coordinates are `[lat, lng]` pairs. A circle keeps its centre and radius;
 * a rectangle keeps two opposite corners; a corridor is a route plus a buffer.
 * The Track map and the breach check work on rings, so every shape is turned
 * into one here, using the same rules as the web's `geofenceGeometry.ts`.
 */
import { Geofence } from '@/data/mock';
import { LatLng } from './geo';
import { textToId } from './ids';

export type FenceType = 'polygon' | 'circle' | 'rectangle' | 'corridor';
export type FenceMode = 'keep_in' | 'keep_out';
export type AlertOn = 'enter' | 'exit' | 'both' | 'none';

export interface GeofenceRow {
  id: string;
  name: string;
  description: string | null;
  fence_type: FenceType;
  coordinates: [number, number][];
  center_lat: number | null;
  center_lng: number | null;
  radius_m: number | null;
  buffer_m: number | null;
  color: string;
  alert_on: AlertOn;
  fence_mode: FenceMode;
  location_id: string | null;
  assigned_animal_ids: string[];
  active: boolean;
  schedule_start: string | null;
  schedule_end: string | null;
  created_by: string;
  created_at?: string;
}

/** What the editor collects. Android draws polygons and circles. */
export interface FenceDraft {
  name: string;
  description: string;
  fenceType: 'polygon' | 'circle';
  points: LatLng[];
  center: LatLng | null;
  radiusM: number;
  mode: FenceMode;
  alertOn: AlertOn;
  color: string;
  assignedAnimalIds: string[];
  active: boolean;
}

/** The web's palette, so a boundary looks the same in both apps. */
export const FENCE_COLORS = ['#7a9a3a', '#e0a526', '#d9534f', '#3b82f6', '#a855f7', '#14b8a6'];

export const DEFAULT_RADIUS_M = 200;

export function emptyDraft(): FenceDraft {
  return {
    name: '',
    description: '',
    fenceType: 'polygon',
    points: [],
    center: null,
    radiusM: DEFAULT_RADIUS_M,
    mode: 'keep_in',
    alertOn: 'both',
    color: FENCE_COLORS[0],
    assignedAnimalIds: [],
    active: true,
  };
}

const EARTH_RADIUS_M = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** A circle as a ring of `steps` points, so it can be drawn and tested like a polygon. */
export function circleRing(center: LatLng, radiusM: number, steps = 48): LatLng[] {
  const ring: LatLng[] = [];
  const angular = radiusM / EARTH_RADIUS_M;
  const lat1 = rad(center.lat);
  const lng1 = rad(center.lng);
  for (let i = 0; i < steps; i += 1) {
    const bearing = (2 * Math.PI * i) / steps;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing));
    const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2));
    ring.push({ lat: deg(lat2), lng: deg(lng2) });
  }
  return ring;
}

/** Two opposite corners to the four corners, as the web does. */
export function rectangleRing(corners: LatLng[]): LatLng[] {
  if (corners.length < 2) return corners;
  const [a, b] = corners;
  return [
    { lat: a.lat, lng: a.lng },
    { lat: a.lat, lng: b.lng },
    { lat: b.lat, lng: b.lng },
    { lat: b.lat, lng: a.lng },
  ];
}

/** A corridor as an outline `bufferM` either side of its route. */
export function corridorRing(route: LatLng[], bufferM: number): LatLng[] {
  if (route.length < 2) return [];
  const left: LatLng[] = [];
  const right: LatLng[] = [];
  route.forEach((p, i) => {
    const a = route[Math.max(0, i - 1)];
    const b = route[Math.min(route.length - 1, i + 1)];
    const k = Math.cos(rad(p.lat));
    const dx = (b.lng - a.lng) * k;
    const dy = b.lat - a.lat;
    const len = Math.hypot(dx, dy) || 1;
    const off = deg(bufferM / EARTH_RADIUS_M);
    const nx = (-dy / len) * off;
    const ny = (dx / len) * off;
    left.push({ lat: p.lat + ny, lng: p.lng + nx / k });
    right.push({ lat: p.lat - ny, lng: p.lng - nx / k });
  });
  return [...left, ...right.reverse()];
}

const pairsToPoints = (c: unknown): LatLng[] =>
  Array.isArray(c)
    ? c
        .filter((p): p is [number, number] => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
        .map(([lat, lng]) => ({ lat, lng }))
    : [];

/** The ring a stored boundary covers. */
export function rowRing(row: Pick<GeofenceRow, 'fence_type' | 'coordinates' | 'center_lat' | 'center_lng' | 'radius_m' | 'buffer_m'>): LatLng[] {
  const points = pairsToPoints(row.coordinates);
  switch (row.fence_type) {
    case 'circle':
      return row.center_lat != null && row.center_lng != null && row.radius_m
        ? circleRing({ lat: row.center_lat, lng: row.center_lng }, row.radius_m)
        : [];
    case 'rectangle':
      return rectangleRing(points);
    case 'corridor':
      return corridorRing(points, row.buffer_m ?? 100);
    default:
      return points;
  }
}

export function rowToGeofence(row: GeofenceRow): Geofence {
  return {
    id: textToId(row.id),
    uuid: row.id,
    name: row.name,
    ring: rowRing(row),
    mode: row.fence_mode === 'keep_out' ? 'keep_out' : 'keep_in',
    color: row.color,
    assignedAnimalIds: row.assigned_animal_ids ?? [],
  };
}

/** A stored boundary back into the editor. Shapes Android can't draw open as polygons. */
export function rowToDraft(row: GeofenceRow): FenceDraft {
  const circle = row.fence_type === 'circle' && row.center_lat != null && row.center_lng != null;
  return {
    name: row.name,
    description: row.description ?? '',
    fenceType: circle ? 'circle' : 'polygon',
    points: circle ? [] : rowRing(row),
    center: circle ? { lat: row.center_lat as number, lng: row.center_lng as number } : null,
    radiusM: row.radius_m ?? DEFAULT_RADIUS_M,
    mode: row.fence_mode === 'keep_out' ? 'keep_out' : 'keep_in',
    alertOn: row.alert_on ?? 'both',
    color: row.color || FENCE_COLORS[0],
    assignedAnimalIds: row.assigned_animal_ids ?? [],
    active: row.active !== false,
  };
}

/** The ring the draft will cover. */
export function draftRing(d: FenceDraft): LatLng[] {
  if (d.fenceType === 'circle') return d.center && d.radiusM > 0 ? circleRing(d.center, d.radiusM) : [];
  return d.points;
}

/** Why the draft can't be saved yet, or null when it can. */
export function draftProblem(d: FenceDraft): 'name' | 'points' | 'centre' | 'radius' | null {
  if (!d.name.trim()) return 'name';
  if (d.fenceType === 'polygon') return d.points.length >= 3 ? null : 'points';
  if (!d.center) return 'centre';
  return d.radiusM > 0 ? null : 'radius';
}

/** The row to insert or update, in the web's shape. `created_by` is only set on insert. */
export function buildGeofenceRow(d: FenceDraft): Omit<GeofenceRow, 'id' | 'created_by' | 'created_at'> {
  const circle = d.fenceType === 'circle';
  return {
    name: d.name.trim(),
    description: d.description.trim() || null,
    fence_type: d.fenceType,
    coordinates: circle ? [] : d.points.map((p) => [p.lat, p.lng] as [number, number]),
    center_lat: circle ? d.center?.lat ?? null : null,
    center_lng: circle ? d.center?.lng ?? null : null,
    radius_m: circle ? Math.round(d.radiusM) : null,
    buffer_m: 100,
    color: d.color,
    alert_on: d.alertOn,
    fence_mode: d.mode,
    location_id: null,
    assigned_animal_ids: d.assignedAnimalIds,
    active: d.active,
    schedule_start: null,
    schedule_end: null,
  };
}

/** Area in hectares (shoelace on a local flat projection, as the web does). */
export function ringAreaHa(ring: LatLng[]): number {
  if (ring.length < 3) return 0;
  const lat0 = rad(ring[0].lat);
  const pts = ring.map((p) => [rad(p.lng) * EARTH_RADIUS_M * Math.cos(lat0), rad(p.lat) * EARTH_RADIUS_M]);
  let s = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s / 2) / 10_000;
}

/** Whether a boundary applies to an animal: all animals, or the ones assigned. */
export function fenceApplies(fence: Geofence, animalKeys: (string | undefined | null)[]): boolean {
  const assigned = fence.assignedAnimalIds ?? [];
  if (assigned.length === 0) return true;
  return animalKeys.some((k) => !!k && assigned.includes(k));
}
