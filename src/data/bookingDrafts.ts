/**
 * "Assignment in progress" (Tester feedback 2026-11-08): the Request Service
 * form for a record is saved as the farmer fills it, so nothing is lost if
 * they leave. Manage Records shows the record as "Assignment in progress"
 * with Continue until the request is sent. Kept on this phone, keyed by AAN.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppointmentMode } from './types';

const KEY = 'ngaren.local.bookingdrafts.v1';

export interface BookingDraft {
  aan: string;
  purposes: string[];
  prefDate: string;
  slot: string;
  mode: AppointmentMode;
  urgency: 'Routine' | 'Emergency';
  notes: string;
  recordAans: string[];
  updatedAt: string;
}

async function readAll(): Promise<BookingDraft[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as BookingDraft[]) : [];
  } catch {
    return [];
  }
}

export async function getBookingDrafts(): Promise<BookingDraft[]> {
  return readAll();
}

export async function getBookingDraft(aan: string): Promise<BookingDraft | undefined> {
  return (await readAll()).find((d) => d.aan === aan);
}

export async function saveBookingDraft(draft: Omit<BookingDraft, 'updatedAt'>): Promise<void> {
  try {
    const all = await readAll();
    const next = [{ ...draft, updatedAt: new Date().toISOString() }, ...all.filter((d) => d.aan !== draft.aan)];
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // best-effort
  }
}

export async function deleteBookingDraft(aan: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify((await readAll()).filter((d) => d.aan !== aan)));
  } catch {
    // best-effort
  }
}
