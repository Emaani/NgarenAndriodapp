import {
  GeofenceRow,
  buildGeofenceRow,
  circleRing,
  draftProblem,
  emptyDraft,
  fenceApplies,
  ringAreaHa,
  rowRing,
  rowToDraft,
  rowToGeofence,
} from '@/lib/geofenceShapes';
import { distanceMeters } from '@/lib/geo';

const row = (over: Partial<GeofenceRow>): GeofenceRow => ({
  id: '0b6f2c1e-1111-4222-8333-444455556666',
  name: 'North',
  description: null,
  fence_type: 'polygon',
  coordinates: [],
  center_lat: null,
  center_lng: null,
  radius_m: null,
  buffer_m: 100,
  color: '#7a9a3a',
  alert_on: 'both',
  fence_mode: 'keep_in',
  location_id: null,
  assigned_animal_ids: [],
  active: true,
  schedule_start: null,
  schedule_end: null,
  created_by: 'u1',
  ...over,
});

// About 100 m a side near the equator.
const SQUARE: [number, number][] = [
  [0.3, 32.5],
  [0.3, 32.5009],
  [0.3009, 32.5009],
  [0.3009, 32.5],
];

describe('geofence shapes', () => {
  it('draws a circle whose points sit on the radius', () => {
    const ring = circleRing({ lat: 0.35, lng: 32.58 }, 250);
    expect(ring).toHaveLength(48);
    for (const p of ring) expect(distanceMeters({ lat: 0.35, lng: 32.58 }, p)).toBeCloseTo(250, -1);
  });

  it('turns each stored shape into a ring', () => {
    expect(rowRing(row({ coordinates: SQUARE }))).toHaveLength(4);
    expect(rowRing(row({ fence_type: 'rectangle', coordinates: [SQUARE[0], SQUARE[2]] }))).toHaveLength(4);
    expect(rowRing(row({ fence_type: 'circle', center_lat: 0.3, center_lng: 32.5, radius_m: 100 }))).toHaveLength(48);
    expect(rowRing(row({ fence_type: 'circle' }))).toEqual([]);
    const corridor = rowRing(row({ fence_type: 'corridor', coordinates: [SQUARE[0], SQUARE[1]], buffer_m: 50 }));
    expect(corridor).toHaveLength(4);
    expect(ringAreaHa(corridor)).toBeCloseTo(1, 0); // 100 m long × 100 m wide
  });

  it('measures area in hectares', () => {
    expect(ringAreaHa(rowRing(row({ coordinates: SQUARE })))).toBeCloseTo(1, 1);
    expect(ringAreaHa([])).toBe(0);
  });

  it('round-trips a polygon and a circle through the web row shape', () => {
    const poly = { ...emptyDraft(), name: ' North ', points: SQUARE.map(([lat, lng]) => ({ lat, lng })), mode: 'keep_out' as const };
    const r = buildGeofenceRow(poly);
    expect(r).toMatchObject({ name: 'North', fence_type: 'polygon', fence_mode: 'keep_out', center_lat: null, radius_m: null });
    expect(r.coordinates).toEqual(SQUARE);
    expect(rowToDraft(row(r)).points).toEqual(poly.points);

    const circle = { ...emptyDraft(), name: 'Dip', fenceType: 'circle' as const, center: { lat: 0.3, lng: 32.5 }, radiusM: 120.4 };
    const c = buildGeofenceRow(circle);
    expect(c).toMatchObject({ fence_type: 'circle', coordinates: [], center_lat: 0.3, center_lng: 32.5, radius_m: 120 });
    expect(rowToDraft(row(c))).toMatchObject({ fenceType: 'circle', center: { lat: 0.3, lng: 32.5 }, radiusM: 120 });
  });

  it('says what is missing before a boundary can be saved', () => {
    expect(draftProblem(emptyDraft())).toBe('name');
    expect(draftProblem({ ...emptyDraft(), name: 'A', points: [{ lat: 0, lng: 0 }] })).toBe('points');
    expect(draftProblem({ ...emptyDraft(), name: 'A', fenceType: 'circle' })).toBe('centre');
    expect(draftProblem({ ...emptyDraft(), name: 'A', fenceType: 'circle', center: { lat: 0, lng: 0 }, radiusM: 0 })).toBe('radius');
    expect(draftProblem({ ...emptyDraft(), name: 'A', fenceType: 'circle', center: { lat: 0, lng: 0 } })).toBeNull();
  });

  it('applies a fence to every animal unless some are assigned', () => {
    const all = rowToGeofence(row({ coordinates: SQUARE }));
    const some = rowToGeofence(row({ coordinates: SQUARE, assigned_animal_ids: ['UG-1126-7K3M9Q'] }));
    expect(all.uuid).toBe('0b6f2c1e-1111-4222-8333-444455556666');
    expect(fenceApplies(all, ['x'])).toBe(true);
    expect(fenceApplies(some, ['x', 'UG-1126-7K3M9Q'])).toBe(true);
    expect(fenceApplies(some, ['x', undefined])).toBe(false);
  });
});
