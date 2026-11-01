/**
 * The farmer's own farm location, offered first when onboarding animals.
 * public.profiles only holds the farm's name, so the full location is kept on the
 * device and in the user's auth metadata, which follows them to any device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured } from '@/config';
import { PlaceDetails } from '@/lib/savedPlaces';
import { supabase } from '@/services/supabase';

const keyFor = (userId: string) => `ngaren.local.farmlocation.v1.${userId}`;

async function sharedLocation(userId: string): Promise<PlaceDetails | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  return user?.id === userId ? ((user.user_metadata?.farm_location as PlaceDetails | undefined) ?? null) : null;
}

async function shareLocation(place: PlaceDetails): Promise<void> {
  if (isSupabaseConfigured()) await supabase.auth.updateUser({ data: { farm_location: place } });
}

export async function getFarmLocation(userId: string | undefined): Promise<PlaceDetails | null> {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    const local = raw ? (JSON.parse(raw) as PlaceDetails) : null;
    const shared = await sharedLocation(userId);
    // Saved while offline, so it never reached the account.
    if (local && !shared) void shareLocation(local).catch(() => undefined);
    return local ?? shared;
  } catch {
    return null;
  }
}

export async function saveFarmLocation(userId: string | undefined, place: PlaceDetails): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(place));
    await shareLocation(place);
  } catch {
    // best-effort
  }
}
