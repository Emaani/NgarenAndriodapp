/**
 * Service Provider vetting status (FR-ADM-01). The admin holds exclusive
 * authority to move a provider through the lifecycle state machine:
 *   pending → active (approved) → suspended → removed.
 * Statuses are stored on-device keyed by provider id (covers both the seeded
 * demo vets and admin-enlisted providers); becomes a write-through to the
 * backend provider-registry when it lands.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ngaren.provider.status.v1';

export type ProviderStatus = 'pending' | 'active' | 'suspended' | 'removed';

export const PROVIDER_STATUS_ORDER: ProviderStatus[] = ['pending', 'active', 'suspended', 'removed'];

export async function getProviderStatuses(): Promise<Record<number, ProviderStatus>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<number, ProviderStatus>) : {};
  } catch {
    return {};
  }
}

export async function setProviderStatus(id: number, status: ProviderStatus): Promise<void> {
  try {
    const all = await getProviderStatuses();
    all[id] = status;
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // best-effort
  }
}
