/**
 * Local, on-device store of animals onboarded through the app.
 *
 * Horizon One's core is photo-first livestock onboarding. The platform-api
 * animal pipeline is mock/not-yet-wired in the current build, so to make
 * onboarding genuinely work end-to-end — register with photos → appears in the
 * list → open its digital ID — freshly registered animals are persisted to
 * AsyncStorage and merged on top of whatever the backend returns. When the real
 * animal backend (and photo upload) lands, this becomes a write-through cache.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animal } from './types';

const KEY = 'ngaren.local.animals.v1';

export async function getLocalAnimals(): Promise<Animal[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Animal[]) : [];
  } catch {
    return [];
  }
}

export async function addLocalAnimal(animal: Animal): Promise<void> {
  try {
    const existing = await getLocalAnimals();
    // Newest first; de-dupe by id in case of a re-submit.
    const next = [animal, ...existing.filter((a) => a.id !== animal.id)];
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Best-effort — a storage failure shouldn't block the onboarding flow.
  }
}

export async function updateLocalAnimal(
  match: (animal: Animal) => boolean,
  patch: Partial<Animal>,
): Promise<void> {
  try {
    const existing = await getLocalAnimals();
    const next = existing.map((animal) => (match(animal) ? { ...animal, ...patch } : animal));
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Best-effort only.
  }
}

export async function getLocalAnimalById(id: number): Promise<Animal | undefined> {
  return (await getLocalAnimals()).find((a) => a.id === id);
}

/** Delete a locally-stored animal (Farmer/Admin delete action). */
export async function deleteLocalAnimal(id: number): Promise<void> {
  try {
    const all = await getLocalAnimals();
    await AsyncStorage.setItem(KEY, JSON.stringify(all.filter((a) => a.id !== id)));
  } catch {
    // best-effort
  }
}

/** Maker-checker: set an animal's approval state (approve / reject). */
export async function setLocalAnimalApproval(
  id: number,
  status: 'approved' | 'rejected',
): Promise<void> {
  try {
    const all = await getLocalAnimals();
    const next = all.map((a) =>
      a.id === id
        ? { ...a, approvalStatus: status, adminApproved: status === 'approved', farmerApproved: status === 'approved' }
        : a,
    );
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // best-effort
  }
}

/** True when a capture needs BOTH admin validation and farmer confirmation
 *  before it is finalised — i.e. a record captured by a third party (a vet).
 *  (Oct 2026 standup: vet-side registration is not final until both sign off.) */
export function requiresDualApproval(a: Animal): boolean {
  return a.capturedByRole === 'veterinary';
}

/**
 * Apply one party's step of a dual approval (admin validation OR farmer
 * confirmation). A rejection by either party rejects the record outright.
 * When both parties have approved, the record is finalised ('approved').
 * Returns the resulting status so callers can decide whether to sync.
 */
export async function setLocalAnimalApprovalStep(
  id: number,
  party: 'admin' | 'farmer',
  status: 'approved' | 'rejected',
): Promise<'approved' | 'rejected' | 'pending'> {
  let resulting: 'approved' | 'rejected' | 'pending' = 'pending';
  try {
    const all = await getLocalAnimals();
    const next = all.map((a) => {
      if (a.id !== id) return a;
      if (status === 'rejected') {
        resulting = 'rejected';
        return { ...a, approvalStatus: 'rejected' as const };
      }
      const adminApproved = a.adminApproved || party === 'admin';
      const farmerApproved = a.farmerApproved || party === 'farmer';
      resulting = adminApproved && farmerApproved ? 'approved' : 'pending';
      return { ...a, adminApproved, farmerApproved, approvalStatus: resulting };
    });
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // best-effort
  }
  return resulting;
}

/** Animals awaiting a checker's approval. */
export async function getPendingLocalAnimals(): Promise<Animal[]> {
  return (await getLocalAnimals()).filter((a) => a.approvalStatus === 'pending');
}
