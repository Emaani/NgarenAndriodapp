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

export async function getLocalAnimalById(id: number): Promise<Animal | undefined> {
  return (await getLocalAnimals()).find((a) => a.id === id);
}

/** Maker-checker: set an animal's approval state (approve / reject). */
export async function setLocalAnimalApproval(
  id: number,
  status: 'approved' | 'rejected',
): Promise<void> {
  try {
    const all = await getLocalAnimals();
    const next = all.map((a) => (a.id === id ? { ...a, approvalStatus: status } : a));
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // best-effort
  }
}

/** Animals awaiting a checker's approval. */
export async function getPendingLocalAnimals(): Promise<Animal[]> {
  return (await getLocalAnimals()).filter((a) => a.approvalStatus === 'pending');
}
