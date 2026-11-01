/**
 * On-device store of the latest confirmation per Bluetooth-tagged animal, read
 * by the animal profile and the device list.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeConfirmations, TagConfirmation } from '@/lib/tagConfirmation';

const KEY = 'ngaren.local.tagconfirmations.v1';

export async function getTagConfirmations(): Promise<Record<string, TagConfirmation>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, TagConfirmation>) : {};
  } catch {
    return {};
  }
}

export async function addTagConfirmations(confirmations: TagConfirmation[]): Promise<void> {
  if (confirmations.length === 0) return;
  try {
    const existing = await getTagConfirmations();
    await AsyncStorage.setItem(KEY, JSON.stringify(mergeConfirmations(existing, confirmations)));
  } catch {
    // best-effort
  }
}
