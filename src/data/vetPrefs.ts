/**
 * Farmer-side vet discovery preferences (Sep 12 2026 standup).
 *
 * The "vets near me" radius defaults to 5 km but is configurable by location
 * (peri-urban vs rural). Persisted on-device; a future backend can seed a
 * location-aware default.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ngaren.vet.nearbyRadiusKm.v1';

export const DEFAULT_RADIUS_KM = 5;
export const RADIUS_OPTIONS = [3, 5, 10, 15, 25] as const;

export async function getNearbyRadiusKm(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_RADIUS_KM;
  } catch {
    return DEFAULT_RADIUS_KM;
  }
}

export async function setNearbyRadiusKm(km: number): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, String(km));
  } catch {
    // best-effort
  }
}
