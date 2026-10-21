/**
 * Follow-up invitations (Oct 20 2026 vet spec — Log Visit rework). A vet can no
 * longer send unsolicited visit logs. Instead, while attending an accepted
 * meeting (so they have the animal record), the vet books a specific follow-up
 * — a vaccination or treatment recheck tied to the AAN. The invitation goes to
 * the farmer; only when the FARMER ACCEPTS does it become a scheduled calendar
 * event (which then shows on both the vet's and farmer's calendars).
 *
 * On-device (AsyncStorage); becomes a backend write-through when the scheduling
 * table lands.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ngaren.local.followups.v1';

export type FollowUpKind = 'vaccination' | 'treatment';
export type FollowUpStatus = 'pending' | 'accepted' | 'declined';

export interface FollowUpInvite {
  id: string;
  aan: string;
  animalLabel: string;
  kind: FollowUpKind;
  /** Proposed date (YYYY-MM-DD) + optional time (HH:MM). */
  date: string;
  time?: string | null;
  note?: string | null;
  vetId?: string | null;
  vetName: string;
  farmerName?: string | null;
  status: FollowUpStatus;
  createdAt: string;
  respondedAt?: string | null;
}

export async function getFollowUps(): Promise<FollowUpInvite[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as FollowUpInvite[]).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) : [];
  } catch {
    return [];
  }
}

export async function getPendingFollowUps(): Promise<FollowUpInvite[]> {
  return (await getFollowUps()).filter((f) => f.status === 'pending');
}

export async function addFollowUp(
  input: Omit<FollowUpInvite, 'id' | 'status' | 'createdAt'>,
): Promise<FollowUpInvite> {
  const record: FollowUpInvite = { ...input, id: `fu-${Date.now()}`, status: 'pending', createdAt: new Date().toISOString() };
  try {
    const all = await getFollowUps();
    await AsyncStorage.setItem(KEY, JSON.stringify([record, ...all].slice(0, 300)));
  } catch {
    // best-effort
  }
  return record;
}

export async function setFollowUpStatus(id: string, status: Exclude<FollowUpStatus, 'pending'>): Promise<void> {
  try {
    const all = await getFollowUps();
    const now = new Date().toISOString();
    await AsyncStorage.setItem(KEY, JSON.stringify(all.map((f) => (f.id === id ? { ...f, status, respondedAt: now } : f))));
  } catch {
    // best-effort
  }
}
