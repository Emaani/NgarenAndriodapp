/**
 * Locally-captured breeding records + lifecycle.
 *
 * Breeding was previously read-only (mock / Supabase `breeding_records`). The
 * Oct 2026 standup asks for a working breeding workflow: a farmer/vet records a
 * mating, confirms the pregnancy at the check, and records calving. Those
 * captures live here on-device (prototype) and merge into the Breeding list,
 * matching the BreedingRecord shape so the screen renders them with no special
 * casing. Expected calving is derived from the mating date using the ~283-day
 * cattle gestation, so the calendar/countdown works without extra input.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BreedingRecord } from './clinical';

const KEY = 'ngaren.local.breeding.v1';
// Mean bovine gestation ≈ 283 days (common MVP default; editable later).
const GESTATION_DAYS = 283;

export type BreedingStatus = 'pending' | 'confirmed' | 'calved';

export interface NewBreeding {
  damName: string;
  damTag: string | null;
  sireName: string;
  sireTag: string | null;
  matingMethod: string;
  matingDate: string;
  notes?: string | null;
}

/** Expected calving date = mating date + gestation, as an ISO yyyy-mm-dd. */
export function expectedCalving(matingDate: string): string | null {
  const d = new Date(matingDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + GESTATION_DAYS);
  return d.toISOString().slice(0, 10);
}

/** True for a record captured on this device (vs mock/remote). */
export const isLocalBreeding = (id: string) => id.startsWith('br-');

async function readAll(): Promise<BreedingRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BreedingRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(records: BreedingRecord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    // best-effort; the list still reflects the in-memory optimistic update
  }
}

export async function getLocalBreedingRecords(): Promise<BreedingRecord[]> {
  return readAll();
}

export async function addLocalBreedingRecord(input: NewBreeding): Promise<BreedingRecord> {
  const record: BreedingRecord = {
    id: `br-${Date.now()}`,
    sireName: input.sireName.trim() || '—',
    sireTag: input.sireTag,
    damName: input.damName.trim() || '—',
    damTag: input.damTag,
    matingDate: input.matingDate,
    matingMethod: input.matingMethod,
    expectedCalvingDate: expectedCalving(input.matingDate),
    pregnancyConfirmed: false,
    offspringCount: 0,
    status: 'pending',
    notes: input.notes?.trim() || null,
  };
  const all = await readAll();
  await writeAll([record, ...all]);
  return record;
}

/** Advance / amend a locally-captured record (pregnancy confirmation, calving). */
export async function updateLocalBreedingRecord(
  id: string,
  patch: Partial<BreedingRecord>,
): Promise<void> {
  const all = await readAll();
  await writeAll(all.map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

/** Confirm the pregnancy at the check (pending → confirmed). */
export async function confirmPregnancy(id: string): Promise<void> {
  await updateLocalBreedingRecord(id, { status: 'confirmed', pregnancyConfirmed: true });
}

/** Record calving (confirmed → calved) with the live offspring count. */
export async function recordCalving(id: string, offspringCount: number): Promise<void> {
  await updateLocalBreedingRecord(id, {
    status: 'calved',
    pregnancyConfirmed: true,
    offspringCount: Math.max(0, Math.round(offspringCount)),
  });
}
