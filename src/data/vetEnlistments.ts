/**
 * Admin-created vet enlistments (Sep 3 2026 "veterinarian enlisting workflow").
 * An admin onboards a vet's professional persona from inside the app; the vet
 * then appears in Find-a-Vet (discoverable + bookable) with the same profile
 * format as the seeded vets. Persisted on-device; becomes a write-through to a
 * backend vet-registry table when that lands.
 *
 * Note: this creates the vet's LISTING, not their login account. Granting the
 * vet app access is a separate step (create an auth user + assign the
 * `veterinary` role) — the enlistment captures their email so it can be linked.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Vet } from './types';

const KEY = 'ngaren.vet.enlistments.v1';

export interface VetEnlistment extends Vet {
  /** Contact email — used to later link the vet's login account. */
  email?: string;
  phone?: string;
  city?: string;
  enlistedBy?: string;
  createdAt: string;
}

export async function getEnlistedVets(): Promise<VetEnlistment[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as VetEnlistment[]) : [];
  } catch {
    return [];
  }
}

export async function getEnlistedVetById(id: number): Promise<VetEnlistment | undefined> {
  return (await getEnlistedVets()).find((v) => v.id === id);
}

export async function addEnlistedVet(
  input: Omit<VetEnlistment, 'id' | 'createdAt' | 'rating' | 'reviews' | 'available'> &
    Partial<Pick<VetEnlistment, 'rating' | 'reviews' | 'available'>>,
): Promise<VetEnlistment> {
  const record: VetEnlistment = {
    // Large, unique id that never collides with the seeded vets (1-4).
    id: Date.now(),
    rating: input.rating ?? 5,
    reviews: input.reviews ?? 0,
    available: input.available ?? true,
    createdAt: new Date().toISOString(),
    ...input,
  };
  try {
    const existing = await getEnlistedVets();
    await AsyncStorage.setItem(KEY, JSON.stringify([record, ...existing]));
  } catch {
    // best-effort
  }
  return record;
}
