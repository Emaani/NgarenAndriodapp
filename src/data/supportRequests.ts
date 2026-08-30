/**
 * On-device store of onboarding "Request for support" work orders (Aug 29 2026
 * standup). When a farmer can't self-onboard, they raise a support request and
 * the app mints a Work Order ID. The Ngaren support team then completes the
 * animal onboarding, device association and activation on the farmer's behalf,
 * tracked against this work order.
 *
 * Local-first like localAnimals; becomes a write-through to the backend work-
 * order queue when that lands.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ngaren.support.requests.v1';

export interface SupportRequest {
  workOrderId: string;
  animalsCount: number;
  notes?: string;
  requestedBy?: string;
  createdAt: string;
  status: 'open' | 'in_progress' | 'completed';
}

/** Mint a Work Order ID, e.g. WO-260829-4F7Q. */
export function generateWorkOrderId(): string {
  const d = new Date();
  const date = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `WO-${date}-${rand}`;
}

export async function getSupportRequests(): Promise<SupportRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SupportRequest[]) : [];
  } catch {
    return [];
  }
}

export async function addSupportRequest(
  input: { animalsCount: number; notes?: string; requestedBy?: string },
): Promise<SupportRequest> {
  const record: SupportRequest = {
    workOrderId: generateWorkOrderId(),
    animalsCount: input.animalsCount,
    notes: input.notes,
    requestedBy: input.requestedBy,
    createdAt: new Date().toISOString(),
    status: 'open',
  };
  try {
    const existing = await getSupportRequests();
    await AsyncStorage.setItem(KEY, JSON.stringify([record, ...existing]));
  } catch {
    // Best-effort — still return the work order so the user gets their reference.
  }
  return record;
}
