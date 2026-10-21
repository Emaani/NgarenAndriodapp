/**
 * Artificial Insemination records (Oct 20 2026 vet spec). The vet completes an
 * AI template per AAN: date of preparation, medication applied, the scheduled
 * return date for the insemination, the sire breed applied, and the semen
 * source. Records are visible to the farmer & Ngaren and locked once saved.
 *
 * On-device (AsyncStorage), best-effort write-through to a Supabase
 * `ai_records` table when configured — never blocking the vet.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from '../services/supabase';

const KEY = 'ngaren.local.ai.records.v1';

export interface AiRecord {
  id: string;
  aan: string;
  animalLabel: string;
  farmerId?: string | null;
  /** Date the AI was prepared (YYYY-MM-DD). */
  preparedDate: string;
  medication?: string | null;
  /** Scheduled date to return for the insemination (YYYY-MM-DD). */
  scheduledDate?: string | null;
  /** Sire breed applied (e.g. Ankole bull, Zebu). */
  sireBreed?: string | null;
  /** Source of the semen (e.g. Nagric). */
  semenSource?: string | null;
  notes?: string | null;
  vetName: string;
  vetId?: string | null;
  createdAt: string;
}

export async function getAiRecords(): Promise<AiRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AiRecord[]).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) : [];
  } catch {
    return [];
  }
}

export async function getAiRecordsForAnimal(keys: string[]): Promise<AiRecord[]> {
  const wanted = keys.filter(Boolean).map((k) => k.toLowerCase());
  return (await getAiRecords()).filter((r) => wanted.includes(r.aan.toLowerCase()) || wanted.includes(r.animalLabel.toLowerCase()));
}

export async function addAiRecord(input: Omit<AiRecord, 'id' | 'createdAt'>): Promise<AiRecord> {
  const record: AiRecord = { ...input, id: `ai-${Date.now()}`, createdAt: new Date().toISOString() };
  try {
    const all = await getAiRecords();
    await AsyncStorage.setItem(KEY, JSON.stringify([record, ...all].slice(0, 300)));
  } catch {
    throw new Error('Could not save the AI record');
  }
  // Best-effort remote write-through (farmer + admin visibility).
  if (isSupabaseConfigured()) {
    void (async () => {
      try {
        await supabase.from('ai_records').insert({
          id: record.id,
          aan: record.aan,
          animal_label: record.animalLabel,
          farmer_id: record.farmerId ?? null,
          prepared_date: record.preparedDate || null,
          medication: record.medication ?? null,
          scheduled_date: record.scheduledDate ?? null,
          sire_breed: record.sireBreed ?? null,
          semen_source: record.semenSource ?? null,
          notes: record.notes ?? null,
          vet_name: record.vetName,
          vet_id: record.vetId ?? null,
          created_at: record.createdAt,
        });
      } catch {
        // table may not be migrated yet — local copy is authoritative
      }
    })();
  }
  return record;
}
