/**
 * The farmer's own farm location, offered first when onboarding animals.
 * public.profiles only holds the farm's name, so the full location stays on the
 * device, per signed-in user.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlaceDetails } from '@/lib/savedPlaces';

const keyFor = (userId: string) => `ngaren.local.farmlocation.v1.${userId}`;

export async function getFarmLocation(userId: string | undefined): Promise<PlaceDetails | null> {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    return raw ? (JSON.parse(raw) as PlaceDetails) : null;
  } catch {
    return null;
  }
}

export async function saveFarmLocation(userId: string | undefined, place: PlaceDetails): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(place));
  } catch {
    // best-effort
  }
}
