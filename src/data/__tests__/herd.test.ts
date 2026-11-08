jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../../services/supabase', () => ({ supabase: {} }));

import { mapLineage, withLocalDetails } from '../herd';
import { Animal } from '../types';
import { isBluetoothAnimal } from '@/lib/tagging';

const row = (animal_tag_id: string | null) => ({ id: 'abc-123', animal_id: 'UG-1026-K7Q2MX', animal_tag_id, animal_breed: 'Ankole' });

describe('mapLineage', () => {
  it('recognises a registered BLE MAC so the tag works on any device', () => {
    const animal = mapLineage(row('AA:BB:CC:DD:EE:01'));
    expect(animal.devices?.[0].bleMac).toBe('AA:BB:CC:DD:EE:01');
    expect(isBluetoothAnimal(animal)).toBe(true);
  });

  it('never reads a satellite serial as a MAC', () => {
    for (const serial of ['123456789012', '982000123456789', 'CRS-00142']) {
      const animal = mapLineage(row(serial));
      expect(animal.devices).toBeUndefined();
      expect(isBluetoothAnimal(animal)).toBe(false);
    }
  });
});

describe('withLocalDetails', () => {
  const remote = mapLineage(row('123456789012'));
  const devices = [{ type: 'ELA Blue COIN ID', serial: 'AA:BB:CC:DD:EE:01', bleMac: 'AA:BB:CC:DD:EE:01' }];
  const local: Animal = {
    ...remote,
    id: 99,
    tag: 'local tag',
    identificationType: 'bluetooth',
    taggingMethod: 'bluetooth',
    devices,
    sex: 'female',
    address: { line1: 'Plot 4' },
    coordinates: { lat: 0.3, lng: 32.5 },
  };

  it('keeps what the backend has no column for after an animal syncs', () => {
    const merged = withLocalDetails(remote, local);
    expect(merged).toMatchObject({ identificationType: 'bluetooth', devices, sex: 'female', address: { line1: 'Plot 4' } });
    expect(isBluetoothAnimal(merged)).toBe(true);
  });

  it('stays on the backend identity and approval', () => {
    const merged = withLocalDetails({ ...remote, approvalStatus: 'approved' }, { ...local, approvalStatus: 'pending' });
    expect(merged).toMatchObject({ id: remote.id, tag: remote.tag, approvalStatus: 'approved' });
  });

  it('leaves animals from other devices untouched', () => {
    expect(withLocalDetails(remote, undefined)).toBe(remote);
  });

  it('shows the photos taken on this phone, not just the one the shared record keeps', () => {
    const shared = { ...remote, photos: ['https://x/old.jpg'] };
    expect(withLocalDetails(shared, { ...local, photos: ['file:///new-front.jpg', 'file:///new-left.jpg'] }).photos).toEqual(['file:///new-front.jpg', 'file:///new-left.jpg']);
    expect(withLocalDetails(shared, { ...local, photos: [] }).photos).toEqual(['https://x/old.jpg']);
  });
});
