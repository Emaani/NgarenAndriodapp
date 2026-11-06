/**
 * Geofence evaluation — which animals are inside their boundaries, which have
 * strayed, and by how far.
 *
 * An animal is considered contained if it falls inside ANY visible geofence.
 * Falling outside every boundary is a breach, reported with the distance to the
 * nearest fence so the herder knows how far out the animal has drifted.
 *
 * This is derived client-side from the live GPS markers already on the Track
 * screen, so it works identically for admin (whole portfolio) and farmer (own
 * herd) — the marker set is already role-scoped by the backend's RLS.
 */
import { AnimalMarker } from './types';
import { Geofence } from './mock';
import { distanceToRingMeters, isPointInPolygon } from '@/lib/geo';
import { fenceApplies } from '@/lib/geofenceShapes';

export interface AnimalFenceStatus {
  animalId: number;
  tag: string;
  lat: number;
  lng: number;
  /** True when the animal is where its boundaries say it should be. */
  inside: boolean;
  /** True when the breach is being inside a keep-out zone rather than outside a paddock. */
  inExclusion: boolean;
  /** The containing fence, or (when breached) the nearest one. */
  fenceId: number | null;
  fenceName: string | null;
  /** Metres beyond the nearest boundary (or into a keep-out zone). 0 when contained. */
  metersOutside: number;
  /** GPS quality, carried through so the UI can flag low-confidence breaches. */
  accuracy: AnimalMarker['accuracy'];
  status: AnimalMarker['status'];
}

export interface FenceOccupancy {
  fence: Geofence;
  animals: AnimalFenceStatus[];
}

export interface GeofenceReport {
  statuses: AnimalFenceStatus[];
  /** Animals outside every boundary, worst (furthest out) first. */
  breaches: AnimalFenceStatus[];
  occupancy: FenceOccupancy[];
  insideCount: number;
  /** True when no boundaries are drawn, so "inside/outside" is meaningless. */
  noFences: boolean;
}

export function evaluateGeofences(markers: AnimalMarker[], fences: Geofence[]): GeofenceReport {
  const statuses: AnimalFenceStatus[] = markers.map((m) => {
    const point = { lat: m.lat, lng: m.lng };
    const base = { animalId: m.animalId, tag: m.tag, lat: m.lat, lng: m.lng, accuracy: m.accuracy, status: m.status };
    // A fence assigned to particular animals only holds those animals.
    const keys = [m.tag, ...(m.keys ?? [])];
    const applicable = fences.filter((f) => fenceApplies(f, keys));
    const keepIn = applicable.filter((f) => f.mode !== 'keep_out');

    // Inside a keep-out zone is a breach, however well the animal is otherwise penned.
    const exclusion = applicable.find((f) => f.mode === 'keep_out' && isPointInPolygon(point, f.ring));
    if (exclusion) {
      return { ...base, inside: false, inExclusion: true, fenceId: exclusion.id, fenceName: exclusion.name, metersOutside: distanceToRingMeters(point, exclusion.ring) };
    }

    // No boundary says where this animal belongs, so it can't be out of place.
    if (keepIn.length === 0) {
      return { ...base, inside: true, inExclusion: false, fenceId: null, fenceName: null, metersOutside: 0 };
    }

    const containing = keepIn.find((f) => isPointInPolygon(point, f.ring));
    if (containing) {
      return { ...base, inside: true, inExclusion: false, fenceId: containing.id, fenceName: containing.name, metersOutside: 0 };
    }

    // Outside everything — report against whichever boundary is closest.
    let nearest: Geofence | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const f of keepIn) {
      const d = distanceToRingMeters(point, f.ring);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = f;
      }
    }

    return {
      ...base,
      inside: false,
      inExclusion: false,
      fenceId: nearest?.id ?? null,
      fenceName: nearest?.name ?? null,
      metersOutside: Number.isFinite(nearestDistance) ? nearestDistance : 0,
    };
  });

  const noFences = fences.length === 0;
  // With no boundaries drawn nothing can be "out", so suppress false alarms.
  const breaches = noFences
    ? []
    : statuses.filter((s) => !s.inside).sort((a, b) => b.metersOutside - a.metersOutside);

  // Occupancy is who is physically inside each boundary, keep-out zones included.
  const occupancy: FenceOccupancy[] = fences.map((fence) => ({
    fence,
    animals: statuses.filter((s) => isPointInPolygon({ lat: s.lat, lng: s.lng }, fence.ring)),
  }));

  return {
    statuses,
    breaches,
    occupancy,
    insideCount: statuses.filter((s) => s.inside).length,
    noFences,
  };
}
