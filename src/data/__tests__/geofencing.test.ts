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

  // A keep-out zone around the paddock's middle, as the web's fence_mode allows.
  const noGo: Geofence = {
    id: 9,
    name: 'Dip tank',
    mode: 'keep_out',
    ring: [
      { lat: 0.3485, lng: 32.5815 },
      { lat: 0.3485, lng: 32.5825 },
      { lat: 0.3475, lng: 32.5825 },
      { lat: 0.3475, lng: 32.5815 },
    ],
  };

  it('treats being inside a keep-out zone as a breach, even within a paddock', () => {
    const report = evaluateGeofences([marker(1, 0.348, 32.582), marker(2, 0.3470, 32.5830)], [...fences, noGo]);
    expect(report.breaches.map((b) => b.animalId)).toEqual([1]);
    expect(report.breaches[0]).toMatchObject({ inExclusion: true, fenceName: 'Dip tank' });
    expect(report.breaches[0].metersOutside).toBeGreaterThan(0);
    // Occupancy is who is physically inside each boundary.
    expect(report.occupancy.find((o) => o.fence.id === 9)?.animals.map((a) => a.animalId)).toEqual([1]);
  });

  it('does not breach an animal that only has keep-out zones', () => {
    const report = evaluateGeofences([marker(1, 0.40, 32.60)], [noGo]);
    expect(report.breaches).toHaveLength(0);
    expect(report.statuses[0].inside).toBe(true);
  });

  it('holds only assigned animals to an assigned boundary', () => {
    const assigned: Geofence = { ...fences[0], assignedAnimalIds: ['UG-1126-AAAAAA'] };
    const stray = { ...marker(1, 0.40, 32.60), keys: ['UG-1126-AAAAAA'] };
    const other = { ...marker(2, 0.40, 32.60), keys: ['UG-1126-BBBBBB'] };
    const report = evaluateGeofences([stray, other], [assigned]);
    expect(report.breaches.map((b) => b.animalId)).toEqual([1]);
  });
});
