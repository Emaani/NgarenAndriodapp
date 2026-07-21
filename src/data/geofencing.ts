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

export interface AnimalFenceStatus {
  animalId: number;
  tag: string;
  lat: number;
  lng: number;
  /** True when the animal sits inside at least one boundary. */
  inside: boolean;
  /** The containing fence, or (when breached) the nearest one. */
  fenceId: number | null;
  fenceName: string | null;
  /** Metres beyond the nearest boundary. 0 when contained. */
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
    const containing = fences.find((f) => isPointInPolygon(point, f.ring));

    if (containing) {
      return {
        animalId: m.animalId,
        tag: m.tag,
        lat: m.lat,
        lng: m.lng,
        inside: true,
        fenceId: containing.id,
        fenceName: containing.name,
        metersOutside: 0,
        accuracy: m.accuracy,
        status: m.status,
      };
    }

    // Outside everything — report against whichever boundary is closest.
    let nearest: Geofence | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const f of fences) {
      const d = distanceToRingMeters(point, f.ring);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = f;
      }
    }

    return {
      animalId: m.animalId,
      tag: m.tag,
      lat: m.lat,
      lng: m.lng,
      inside: false,
      fenceId: nearest?.id ?? null,
      fenceName: nearest?.name ?? null,
      metersOutside: Number.isFinite(nearestDistance) ? nearestDistance : 0,
      accuracy: m.accuracy,
      status: m.status,
    };
  });

  const noFences = fences.length === 0;
  // With no boundaries drawn nothing can be "out", so suppress false alarms.
  const breaches = noFences
    ? []
    : statuses.filter((s) => !s.inside).sort((a, b) => b.metersOutside - a.metersOutside);

  const occupancy: FenceOccupancy[] = fences.map((fence) => ({
    fence,
    animals: statuses.filter((s) => s.inside && s.fenceId === fence.id),
  }));

  return {
    statuses,
    breaches,
    occupancy,
    insideCount: statuses.filter((s) => s.inside).length,
    noFences,
  };
}
