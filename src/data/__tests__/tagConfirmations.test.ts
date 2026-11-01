jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/config', () => ({ isSupabaseConfigured: () => true }));

const mockInsert = jest.fn();
const mockRemote = jest.fn();
jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }) },
    from: () => ({
      insert: mockInsert,
      select: () => ({ eq: () => ({ order: () => ({ limit: mockRemote }) }) }),
    }),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { TagConfirmation } from '@/lib/tagConfirmation';
import { addTagConfirmations, confirmationFromAuditRow, confirmationToAuditRow, getTagConfirmations } from '../tagConfirmations';

const confirmation = (over: Partial<TagConfirmation> = {}): TagConfirmation => ({
  animalKey: 'UG-1026-K7Q2MX',
  at: '2026-11-01T10:00:00.000Z',
  by: 'Dr. Sarah',
  via: 'ble',
  locationName: 'Home kraal',
  ...over,
});

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockInsert.mockResolvedValue({ error: null });
  mockRemote.mockResolvedValue({ data: [], error: null });
});

describe('audit rows', () => {
  it('round-trips a confirmation', () => {
    const c = confirmation();
    const row = confirmationToAuditRow(c, 'user-1');
    expect(row).toMatchObject({ actor_id: 'user-1', action_type: 'tag_confirmed', entity_type: 'animal', entity_id: c.animalKey });
    expect(confirmationFromAuditRow(row)).toEqual(c);
  });

  it('ignores a row that is not a confirmation', () => {
    expect(confirmationFromAuditRow({ entity_id: 'x', after: null })).toBeNull();
    expect(confirmationFromAuditRow({ entity_id: 'x', after: { at: 'now' } })).toBeNull();
  });
});

describe('sharing', () => {
  it('sends a confirmation as soon as it is added', async () => {
    await addTagConfirmations([confirmation()]);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    await getTagConfirmations();
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('keeps a confirmation made without signal and sends it later', async () => {
    mockInsert.mockResolvedValueOnce({ error: new Error('offline') });
    await addTagConfirmations([confirmation()]);
    expect(await getTagConfirmations()).toHaveProperty('UG-1026-K7Q2MX');
    expect(mockInsert).toHaveBeenCalledTimes(2);
    await getTagConfirmations();
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it('shows what another device confirmed, newest first', async () => {
    await addTagConfirmations([confirmation()]);
    const newer = confirmation({ at: '2026-11-02T08:00:00.000Z', by: 'Another tester' });
    mockRemote.mockResolvedValue({ data: [confirmationToAuditRow(newer, 'user-2')], error: null });
    expect((await getTagConfirmations())['UG-1026-K7Q2MX'].by).toBe('Another tester');
  });

  it('falls back to this device when the shared log cannot be read', async () => {
    await addTagConfirmations([confirmation()]);
    mockRemote.mockRejectedValue(new Error('offline'));
    expect((await getTagConfirmations())['UG-1026-K7Q2MX'].by).toBe('Dr. Sarah');
  });
});
