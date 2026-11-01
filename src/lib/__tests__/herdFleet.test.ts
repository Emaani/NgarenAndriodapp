import { Animal } from '@/data/types';
import { devicesFromHerd, locationKind, locationsFromHerd, summaryFromHerd } from '../herdFleet';
import { textToId } from '../ids';

const animal = (over: Partial<Animal>): Animal => ({
  id: 1,
  tag: 'T1',
  breed: { key: 'ankole', name: 'Ankole' },
  dateOfBirth: '',
  status: 'active',
  deviceSerial: null,
  ...over,
});

const ble = animal({
  id: 1,
  name: 'Zara',
  taggingMethod: 'bluetooth',
  deviceSerial: 'E4:15:F6:00:11:22',
  devices: [{ type: 'ELA Blue COIN ID', serial: 'E4:15:F6:00:11:22', bleMac: 'E4:15:F6:00:11:22' }],
  locationName: 'Home kraal',
  address: { line1: 'Plot 4', city: 'Mbarara', country: 'Uganda' },
});
const satelliteFromBackend = animal({ id: 2, tag: 'T2', deviceSerial: '982000123', locationName: 'Home kraal' });
const visualOnly = animal({ id: 3, tag: 'T3', devices: [{ type: 'Visual ear tag', serial: 'V-1' }], locationName: 'Water Point A' });
const noPlace = animal({ id: 4, tag: 'T4' });
const herd = [ble, satelliteFromBackend, visualOnly, noPlace];

describe('devicesFromHerd', () => {
  const devices = devicesFromHerd(herd);

  it('lists each connected tag, linked to its animal', () => {
    expect(devices.map((d) => d.serial)).toEqual(['E4:15:F6:00:11:22', '982000123']);
    expect(devices[0]).toMatchObject({ model: 'ELA Blue COIN ID', brand: 'ELA Innovation', family: 'Bluetooth', linkedAnimalId: 1, linkedAnimalTag: 'Zara' });
  });

  it('keeps a tag known only from its backend serial', () => {
    expect(devices[1]).toMatchObject({ family: 'Satellite', linkedAnimalTag: 'T2' });
  });

  it('never treats a visual ear tag as a device', () => {
    expect(devices.some((d) => d.serial === 'V-1')).toBe(false);
  });

  it('lists a tag once when a local and a synced record both hold it', () => {
    expect(devicesFromHerd([ble, { ...ble, id: 9 }])).toHaveLength(1);
  });

  it('gives a device an id that survives a reload', () => {
    expect(devices[0].id).toBe(devicesFromHerd(herd)[0].id);
    expect(devices[0].id).not.toBe(devices[1].id);
  });
});

describe('locationsFromHerd', () => {
  const locations = locationsFromHerd(herd);

  it('lists each place once, with how many animals are there', () => {
    expect(locations.map((l) => [l.name, l.animalCount])).toEqual([['Home kraal', 2], ['Water Point A', 1]]);
  });

  it('builds the address from what was captured', () => {
    expect(locations[0].address).toBe('Plot 4, Mbarara, Uganda');
  });

  it('classifies a place from its name', () => {
    expect(locationKind('Water Point A')).toBe('water');
    expect(locationKind('Sorting Yard')).toBe('yard');
    expect(locationKind('Home kraal')).toBe('paddock');
  });
});

describe('summaryFromHerd', () => {
  it('matches the lists the dashboard opens', () => {
    expect(summaryFromHerd(herd)).toMatchObject({
      animals: 4,
      devices: devicesFromHerd(herd).length,
      locations: locationsFromHerd(herd).length,
      allocation: { allocated: 2, free: 0 },
      connectivity: { connected: 2, unconnected: 2 },
    });
  });

  it('is all zeros for an empty herd, so nothing fake shows while loading', () => {
    expect(summaryFromHerd([])).toMatchObject({ animals: 0, devices: 0, locations: 0, connectivity: { connected: 0, unconnected: 0 } });
  });
});

describe('textToId', () => {
  it('tells apart text the uuid helper would collapse', () => {
    expect(textToId('north paddock')).not.toBe(textToId('south paddock'));
    expect(Number.isSafeInteger(textToId('home kraal'))).toBe(true);
    expect(textToId('home kraal')).toBeGreaterThanOrEqual(0);
  });
});
