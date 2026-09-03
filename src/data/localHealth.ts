/**
 * Local digital health records, keyed to an animal's Ngaren code (or tag).
 *
 * Backs the "log a new health event" form and the per-animal Health History
 * timeline. Farmers and vets both write here. Persisted on-device for the
 * prototype; the shape maps onto the web `health_records` table (animal_name,
 * category, medication, notes, created_at) for later write-through.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ngaren.local.health.v1';

// Managed-health service/event types. 'consultation' added per the managed-
// health MVP (vaccination / treatment / consultation), alongside 'ailment'.
export type HealthEventType = 'vaccination' | 'treatment' | 'consultation' | 'ailment';

// Structured field observations for MVP data collection (disease/pest trends).
export const HEALTH_OBSERVATIONS = ['Ticks', 'Flies', 'Worms', 'Disease', 'Wounds', 'Lameness'] as const;
export type HealthObservation = (typeof HEALTH_OBSERVATIONS)[number];

export interface LocalHealthRecord {
  id: string;
  animalKey: string; // ngaren code or tag
  animalLabel: string;
  type: HealthEventType;
  medication: string | null;
  notes: string;
  photo: string | null;
  /** Structured pest/disease observations for trend analytics. */
  observations?: HealthObservation[];
  recordedBy: string;
  date: string; // ISO date of the event
  createdAt: string;
}

export const HEALTH_TYPE_LABELS: Record<HealthEventType, string> = {
  vaccination: 'Vaccination',
  treatment: 'Treatment',
  consultation: 'Consultation',
  ailment: 'Ailment',
};

export async function getLocalHealthRecords(animalKey?: string): Promise<LocalHealthRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const all: LocalHealthRecord[] = raw ? (JSON.parse(raw) as LocalHealthRecord[]) : [];
    const list = animalKey ? all.filter((r) => r.animalKey === animalKey) : all;
    // Newest event first.
    return list.sort((a, b) => (a.date < b.date ? 1 : -1));
  } catch {
    return [];
  }
}

export async function addLocalHealthRecord(
  record: Omit<LocalHealthRecord, 'id' | 'createdAt'>,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const all: LocalHealthRecord[] = raw ? (JSON.parse(raw) as LocalHealthRecord[]) : [];
    const full: LocalHealthRecord = { ...record, id: `hr-${Date.now()}`, createdAt: new Date().toISOString() };
    await AsyncStorage.setItem(KEY, JSON.stringify([full, ...all]));
  } catch {
    // best-effort
  }
}
