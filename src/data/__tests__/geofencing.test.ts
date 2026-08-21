import { evaluateGeofences } from '@/data/geofencing';
import { AnimalMarker } from '@/data/types';
import { Geofence } from '@/data/mock';

const fences: Geofence[] = [
  {
    id: 1,
    name: 'North Paddock',
    ring: [
      { lat: 0.3495, lng: 32.5805 },
      { lat: 0.3495, lng: 32.5835 },
      { lat: 0.3468, lng: 32.5838 },
      { lat: 0.3466, lng: 32.5808 },
    ],
  },
];

const marker = (animalId: number, lat: number, lng: number): AnimalMarker => ({
  animalId,
  tag: `A-${animalId}`,
  lat,
  lng,
  accuracy: 'Good',
  lastSeenMins: 5,
  status: 'active',
});

describe('evaluateGeofences', () => {
  it('flags an animal outside every boundary as a breach with a distance', () => {
    const report = evaluateGeofences([marker(1, 0.348, 32.582), marker(2, 0.3512, 32.5792)], fences);
    expect(report.insideCount).toBe(1);
    expect(report.breaches.map((b) => b.animalId)).toEqual([2]);
    expect(report.breaches[0].metersOutside).toBeGreaterThan(0);
    expect(report.breaches[0].fenceName).toBe('North Paddock');
  });

  it('reports no breaches when no fences are drawn (avoids false alarms)', () => {
    const report = evaluateGeofences([marker(1, 0.348, 32.582)], []);
    expect(report.noFences).toBe(true);
    expect(report.breaches).toHaveLength(0);
  });

  it('sorts breaches furthest-out first', () => {
    const report = evaluateGeofences([marker(1, 0.3512, 32.5792), marker(2, 0.40, 32.60)], fences);
    expect(report.breaches[0].metersOutside).toBeGreaterThanOrEqual(report.breaches[1].metersOutside);
  });
});
