/**
 * "Primary providers" — vets a farmer saves as trusted for quick access
 * (Sep 3 2026 standup). Persisted on-device; the Find-a-Vet list surfaces these
 * first. Local-first like the other stores; becomes a write-through when the
 * backend vet-relationship table lands.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ngaren.primary.vets.v1';

export async function getPrimaryVetIds(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as number[]) : [];
  } catch {
    return [];
  }
}

export async function isPrimaryVet(id: number): Promise<boolean> {
  return (await getPrimaryVetIds()).includes(id);
}

/** Add or remove a vet from the trusted list. Returns the new saved state. */
export async function togglePrimaryVet(id: number): Promise<boolean> {
  const ids = await getPrimaryVetIds();
  const has = ids.includes(id);
  const next = has ? ids.filter((x) => x !== id) : [...ids, id];
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // best-effort
  }
  return !has;
}
