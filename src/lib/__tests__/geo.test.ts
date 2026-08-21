import { distanceMeters, distanceToRingMeters, isPointInPolygon, LatLng } from '@/lib/geo';

// A ~square paddock near Kampala.
const ring: LatLng[] = [
  { lat: 0.3495, lng: 32.5805 },
  { lat: 0.3495, lng: 32.5835 },
  { lat: 0.3468, lng: 32.5838 },
  { lat: 0.3466, lng: 32.5808 },
];

describe('isPointInPolygon', () => {
  it('detects a point inside the ring', () => {
    expect(isPointInPolygon({ lat: 0.348, lng: 32.582 }, ring)).toBe(true);
  });
  it('detects a point outside the ring', () => {
    expect(isPointInPolygon({ lat: 0.36, lng: 32.6 }, ring)).toBe(false);
  });
  it('returns false for a degenerate ring', () => {
    expect(isPointInPolygon({ lat: 0.348, lng: 32.582 }, ring.slice(0, 2))).toBe(false);
  });
});

describe('distances', () => {
  it('distanceMeters is ~0 for the same point and positive otherwise', () => {
    expect(distanceMeters(ring[0], ring[0])).toBeCloseTo(0, 5);
    expect(distanceMeters(ring[0], ring[2])).toBeGreaterThan(100);
  });
  it('distanceToRingMeters is 0-ish on the boundary and grows outside', () => {
    const near = distanceToRingMeters({ lat: 0.3495, lng: 32.582 }, ring); // on top edge
    const far = distanceToRingMeters({ lat: 0.36, lng: 32.582 }, ring);
    expect(near).toBeLessThan(5);
    expect(far).toBeGreaterThan(near + 500);
  });
});
