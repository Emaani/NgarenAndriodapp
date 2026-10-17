/**
 * Animal registration drafts — "Registration in Progress" (Oct 2026 spec 3.1.1).
 * Once an AAN is generated, the whole wizard state is auto-saved here keyed by
 * AAN, so the farmer (or an assigned Ngaren Service Provider) can resume or edit
 * it later from Manage Animal Records. On successful submission the draft is
 * cleared and becomes a real animal record.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RegisteredDevice } from './types';

const KEY = 'ngaren.local.regdrafts.v1';

export interface RegistrationDraft {
  aan: string;
  idType?: 'physical' | 'satellite' | 'bluetooth' | '';
  sex?: 'male' | 'female' | '';
  purpose?: string;
  tag?: string;
  name?: string;
  color?: string;
  breedKey?: string;
  dob?: string;
  damChoice?: string;
  damExternal?: string;
  sireChoice?: string;
  sireExternal?: string;
  photos?: (string | null)[];
  locationId?: string;
  addr1?: string;
  addr2?: string;
  city?: string;
  country?: string;
  coords?: { lat: number; lng: number } | null;
  devices?: RegisteredDevice[];
  notes?: string;
  startedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getDrafts(): Promise<RegistrationDraft[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as RegistrationDraft[]) : [];
  } catch {
    return [];
  }
}

export async function getDraft(aan: string): Promise<RegistrationDraft | undefined> {
  return (await getDrafts()).find((d) => d.aan === aan);
}

export async function saveDraft(draft: Omit<RegistrationDraft, 'createdAt' | 'updatedAt'> & Partial<Pick<RegistrationDraft, 'createdAt'>>): Promise<void> {
  try {
    const all = await getDrafts();
    const now = new Date().toISOString();
    const existing = all.find((d) => d.aan === draft.aan);
    const record: RegistrationDraft = { ...draft, createdAt: existing?.createdAt ?? draft.createdAt ?? now, updatedAt: now };
    const next = [record, ...all.filter((d) => d.aan !== draft.aan)];
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // best-effort
  }
}

export async function deleteDraft(aan: string): Promise<void> {
  try {
    const all = await getDrafts();
    await AsyncStorage.setItem(KEY, JSON.stringify(all.filter((d) => d.aan !== aan)));
  } catch {
    // best-effort
  }
}
