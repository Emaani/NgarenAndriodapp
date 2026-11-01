import { Animal, Location } from '@/data/types';
import { accountPlace, hasPlaceDetails, herdPlaces, parsePhysicalAddress, placeChoices } from '@/lib/savedPlaces';

let nextId = 1;
const animal = (fields: Partial<Animal>): Animal => ({
  id: nextId++,
  tag: `T-${nextId}`,
  breed: { key: 'ankole', name: 'Ankole' },
  dateOfBirth: '',
  status: 'active',
  ...fields,
});
const paddock = (id: number, name: string): Location => ({ id, name, address: '', sizeHa: 1, animalCount: 0, kind: 'paddock' });

describe('parsePhysicalAddress', () => {
  it('reads older joined addresses from the end', () => {
    expect(parsePhysicalAddress('Plot 4, Block B, Mbarara, Uganda')).toEqual({ line1: 'Plot 4', line2: 'Block B', city: 'Mbarara', country: 'Uganda' });
    expect(parsePhysicalAddress('Mbarara, Uganda')).toEqual({ line1: undefined, line2: undefined, city: 'Mbarara', country: 'Uganda' });
    expect(parsePhysicalAddress('Uganda')).toEqual({ country: 'Uganda' });
    expect(parsePhysicalAddress(undefined)).toEqual({});
  });
});

describe('herdPlaces', () => {
  it('groups animals at the same location and counts them, newest place first', () => {
    const places = herdPlaces([
      animal({ locationName: 'Home kraal', address: { line1: 'Plot 4', city: 'Mbarara', country: 'Uganda' } }),
      animal({ locationName: 'River camp' }),
      animal({ locationName: ' home KRAAL ' }),
    ]);
    expect(places.map((p) => [p.label, p.animalCount])).toEqual([['Home kraal', 2], ['River camp', 1]]);
    expect(places[0].line1).toBe('Plot 4');
  });

  it('groups by address when the location has no name', () => {
    const address = { line1: 'Plot 4', city: 'Mbarara', country: 'Uganda' };
    const places = herdPlaces([animal({ address }), animal({ physicalAddress: 'Plot 4, Mbarara, Uganda' })]);
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ label: 'Plot 4', animalCount: 2 });
  });

  it('never offers the pre-filled country alone as a place', () => {
    expect(herdPlaces([animal({ physicalAddress: 'Uganda' }), animal({})])).toEqual([]);
  });

  it('counts a synced animal once and keeps the details from its local record', () => {
    const local = animal({ ngarenCode: 'UG-1', locationName: 'Home kraal', address: { line1: 'Plot 4' } });
    const remote = animal({ ngarenCode: 'UG-1', locationName: 'Home kraal' });
    expect(herdPlaces([local, remote])).toEqual([expect.objectContaining({ animalCount: 1, line1: 'Plot 4' })]);
  });

  it('fills gaps from other animals at the same place', () => {
    const coords = { lat: 0.3, lng: 32.5 };
    const places = herdPlaces([animal({ locationName: 'Home kraal' }), animal({ locationName: 'Home kraal', coordinates: coords })]);
    expect(places[0].coords).toEqual(coords);
  });
});

describe('accountPlace', () => {
  it('prefers the saved location, else the farm name', () => {
    expect(accountPlace({ name: 'Home', city: 'Mbarara' }, 'Nakasero Farm')).toEqual({ name: 'Home', city: 'Mbarara' });
    expect(accountPlace(null, ' Nakasero Farm ')).toEqual({ name: 'Nakasero Farm' });
  });

  it('skips a farm_id that is an id rather than a name', () => {
    expect(accountPlace(null, '3f2b1c9e-1234-4abc-9def-001122334455')).toBeNull();
    expect(accountPlace(null, null)).toBeNull();
  });
});

describe('placeChoices', () => {
  it('lists my farm first, then the herd, then paddocks', () => {
    const choices = placeChoices({
      account: { name: 'Nakasero Farm' },
      animals: [animal({ locationName: 'River camp' })],
      paddocks: [paddock(7, 'North Paddock')],
    });
    expect(choices.map((c) => [c.source, c.label])).toEqual([['account', 'Nakasero Farm'], ['herd', 'River camp'], ['paddock', 'North Paddock']]);
  });

  it('shows my farm once, with the herd count and details', () => {
    const coords = { lat: 0.3, lng: 32.5 };
    const choices = placeChoices({
      account: { name: 'Nakasero Farm' },
      animals: [animal({ locationName: 'nakasero farm', coordinates: coords }), animal({ locationName: 'Nakasero Farm' })],
      paddocks: [],
    });
    expect(choices).toHaveLength(1);
    expect(choices[0]).toMatchObject({ source: 'account', animalCount: 2, coords });
  });

  it('links a herd place to its paddock instead of listing it twice', () => {
    const choices = placeChoices({ account: null, animals: [animal({ locationName: 'North Paddock' })], paddocks: [paddock(7, 'North Paddock')] });
    expect(choices).toHaveLength(1);
    expect(choices[0]).toMatchObject({ source: 'herd', locationId: 7 });
  });

  it('is empty for a first animal with no farm on the account', () => {
    expect(placeChoices({ account: null, animals: [], paddocks: [] })).toEqual([]);
    expect(hasPlaceDetails({ country: 'Uganda' })).toBe(false);
  });
});
