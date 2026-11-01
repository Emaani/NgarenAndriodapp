jest.mock('../../config', () => ({ isSupabaseConfigured: () => true }));

const mockRpc = jest.fn();
jest.mock('../../services/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));

import { calloutToRow } from '../callouts';
import { vets as seededVets } from '../mock';
import { findVet, getVetDirectory, rowToVet } from '../vetDirectory';

const USER_ID = '3f2b1c9e-1234-4abc-9def-001122334455';
const row = { user_id: USER_ID, full_name: 'Dr. Sarah Namukasa', rating: 4.5, reviews: 2 };

beforeEach(() => mockRpc.mockReset());

describe('getVetDirectory', () => {
  it('lists real vets once the database function exists', async () => {
    mockRpc.mockResolvedValue({ data: [row], error: null });
    expect(await getVetDirectory()).toEqual([expect.objectContaining({ name: 'Dr. Sarah Namukasa', userId: USER_ID, rating: 4.5, reviews: 2 })]);
    expect(mockRpc).toHaveBeenCalledWith('get_bookable_vets');
  });

  it('keeps the seeded list while the function is not deployed', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    expect(await getVetDirectory()).toBe(seededVets);
  });

  it('keeps the seeded list when the network fails', async () => {
    mockRpc.mockRejectedValue(new Error('offline'));
    expect(await getVetDirectory()).toBe(seededVets);
  });

  it('finds a vet by the id the screens use', async () => {
    mockRpc.mockResolvedValue({ data: [row], error: null });
    expect((await findVet(rowToVet(row).id))?.userId).toBe(USER_ID);
  });
});

describe('rowToVet', () => {
  it('leaves distance unknown, because vets have no saved position', () => {
    expect(rowToVet(row).distanceKm).toBe(0);
  });

  it('copes with a vet nobody has rated', () => {
    expect(rowToVet({ user_id: USER_ID, full_name: null, rating: null, reviews: null })).toMatchObject({ name: 'Veterinarian', rating: 0, reviews: 0 });
  });
});

describe('booking a chosen vet', () => {
  const booking = { animal: 'Zara', locationName: 'Farm', urgency: 'Routine' as const };

  it('goes straight to a real vet', () => {
    expect(calloutToRow({ ...booking, vetUserId: USER_ID }, 'farmer-1').preferred_vet_id).toBe(USER_ID);
  });

  it('stays open to all vets when no real vet was chosen', () => {
    expect(calloutToRow(booking, 'farmer-1').preferred_vet_id).toBeNull();
  });
});
