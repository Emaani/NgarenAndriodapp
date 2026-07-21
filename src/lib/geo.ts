/**
 * Geofencing maths — containment and breach distance.
 *
 * Everything here is pure and dependency-free so it can run on every render
 * without touching the map layer. Distances use an equirectangular
 * approximation, which is accurate to well under a metre at paddock scale and
 * far cheaper than full haversine over every animal × every edge.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Ray-casting point-in-polygon. Returns true when the point lies inside the
 * ring. Points exactly on an edge are not guaranteed either way — at GPS
 * precision that ambiguity is not meaningful.
 */
export function isPointInPolygon(point: LatLng, ring: LatLng[]): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].lng;
    const yi = ring[i].lat;
    const xj = ring[j].lng;
    const yj = ring[j].lat;
    const straddles = yi > point.lat !== yj > point.lat;
    if (straddles && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Great-circle-ish distance in metres between two coordinates. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const meanLat = toRad((a.lat + b.lat) / 2);
  const x = toRad(b.lng - a.lng) * Math.cos(meanLat);
  const y = toRad(b.lat - a.lat);
  return Math.sqrt(x * x + y * y) * EARTH_RADIUS_M;
}

/** Shortest distance in metres from a point to a line segment. */
function distanceToSegmentMeters(p: LatLng, a: LatLng, b: LatLng): number {
  // Project into a local metre-plane so the segment maths is plain Euclidean.
  const meanLat = toRad((a.lat + b.lat) / 2);
  const mx = (lng: number) => toRad(lng) * Math.cos(meanLat) * EARTH_RADIUS_M;
  const my = (lat: number) => toRad(lat) * EARTH_RADIUS_M;

  const px = mx(p.lng);
  const py = my(p.lat);
  const ax = mx(a.lng);
  const ay = my(a.lat);
  const bx = mx(b.lng);
  const by = my(b.lat);

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);

  // Clamp the projection to the segment so we never measure past an endpoint.
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Shortest distance in metres from a point to a polygon's boundary. */
export function distanceToRingMeters(point: LatLng, ring: LatLng[]): number {
  if (ring.length === 0) return Number.POSITIVE_INFINITY;
  if (ring.length === 1) return distanceMeters(point, ring[0]);
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const d = distanceToSegmentMeters(point, ring[j], ring[i]);
    if (d < min) min = d;
  }
  return min;
}

/** Format a metre distance for display: "180 m", "1.4 km". */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
