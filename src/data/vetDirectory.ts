/**
 * The vets a farmer can book. profiles and user_roles are private to each user,
 * so the list comes from the get_bookable_vets database function, which shares
 * only a name and rating (docs/backend/proposed-rls-and-vet-directory.sql).
 * Until that function is deployed, Find a Vet keeps the seeded list.
 */
import { isSupabaseConfigured } from '../config';
import { uuidToId } from '../lib/ids';
import { supabase } from '../services/supabase';
import { vets as seededVets } from './mock';
import { Vet } from './types';

export function rowToVet(row: Record<string, unknown>): Vet {
  const userId = String(row.user_id);
  return {
    id: uuidToId(userId),
    userId,
    name: (row.full_name as string | null) ?? 'Veterinarian',
    clinic: '',
    specialty: 'Veterinarian',
    // Vets have no saved position yet; 0 means "not known" to the screens.
    distanceKm: 0,
    rating: Number(row.rating ?? 0),
    reviews: Number(row.reviews ?? 0),
    available: true,
  };
}

export async function getVetDirectory(): Promise<Vet[]> {
  if (!isSupabaseConfigured()) return seededVets;
  try {
    const { data, error } = await supabase.rpc('get_bookable_vets');
    if (error || !data?.length) return seededVets;
    return (data as Record<string, unknown>[]).map(rowToVet);
  } catch {
    return seededVets;
  }
}

export async function findVet(id: number): Promise<Vet | undefined> {
  return (await getVetDirectory()).find((v) => v.id === id);
}
