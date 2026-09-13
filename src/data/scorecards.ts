/**
 * Vet Visit Scorecard store (Sep 7 2026 standup + "Livestock Health Scorecard"
 * UI design). A scorecard is the full record of one vet visit: baseline vitals
 * (body-condition score is the real analytical field; the rest are optional
 * placeholders until device integration), diagnosis, medication & treatment,
 * grooming, an optional pregnancy observation and vet notes.
 *
 * Two hard rules from the standup:
 *  - A submitted scorecard is PERMANENTLY LOCKED (no retrospective edits;
 *    corrections are a new dated entry; only an admin can modify).
 *  - The same green/amber/red status system is used on the form, the history
 *    timeline and the drill-down.
 *
 * Stored on-device (AsyncStorage) like the other local clinical stores; the
 * shape maps onto a future `livestock_scorecards` table for write-through.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from '../services/supabase';

const KEY = 'ngaren.vet.scorecards.v1';

export type ScorecardStatus = 'healthy' | 'monitor' | 'urgent';

export type TreatmentRoute = 'Oral' | 'IM' | 'IV' | 'Topical';

/** Standardized diagnosis conditions (searchable multi-select) + custom tags. */
export const CONDITION_TAGS = [
  'Lameness',
  'Mastitis',
  'Parasites (ticks)',
  'Worms',
  'Respiratory',
  'Diarrhoea',
  'Reproductive',
  'Wound / injury',
  'Eye infection',
  'Skin condition',
  'Foot rot',
  'Bloat',
  'Malnutrition',
] as const;

/** Grooming & hygiene checklist chips — tap-based, no typing. */
export const GROOMING_CHIPS = [
  'Hoof / nail trim',
  'Coat / skin clean',
  'Deworming',
  'Tick / parasite control',
  'Dehorning',
  'Ear tag check',
] as const;

/** Formulary suggestions for the drug/treatment picker (plus free custom entry). */
export const DRUG_FORMULARY = [
  'Oxytetracycline',
  'Penicillin',
  'Ivermectin',
  'Albendazole',
  'Flunixin',
  'Multivitamin',
  'Dewormer',
  'Acaricide',
  'FMD vaccine',
  'Lumpy skin vaccine',
  'Anthelmintic drench',
] as const;

export const TREATMENT_ROUTES: TreatmentRoute[] = ['Oral', 'IM', 'IV', 'Topical'];

export interface ScorecardVitals {
  /** Body condition score 1–5 — the analytical field kept for trends. */
  bcs: number | null;
  /** Optional placeholders until device integration / accurate capture. */
  temperature?: number | null;
  weight?: number | null;
  heartRate?: number | null;
  respRate?: number | null;
  age?: number | null;
}

export interface ScorecardTreatment {
  drug?: string | null;
  dose?: string | null;
  route?: TreatmentRoute | null;
  frequency?: string | null;
  nextDueDate?: string | null;
}

export interface ScorecardPregnancy {
  /** Whether the observation applies (female animal). */
  applicable: boolean;
  inCalf?: boolean | null;
  dueDate?: string | null;
}

export interface Scorecard {
  id: string;
  animalKey: string;
  animalLabel: string;
  farmName?: string | null;
  breed?: string | null;
  sex?: string | null;
  /** The animal's owner (auth uid), so farmers can read their own scorecards. */
  farmerId?: string | null;
  status: ScorecardStatus;
  visitType: string;
  vitals: ScorecardVitals;
  diagnosisTags: string[];
  diagnosisNotes?: string | null;
  treatment: ScorecardTreatment;
  grooming: string[];
  groomingBcs?: number | null;
  pregnancy?: ScorecardPregnancy | null;
  notes?: string | null;
  /** "Flag for recheck" — counts as an open follow-up until cleared. */
  flagRecheck: boolean;
  photo?: string | null;
  vetName: string;
  vetId?: string | null;
  date: string;
  createdAt: string;
  /** Always true — a submitted scorecard is locked from editing. */
  locked: true;
}

/** Species-normal core body temperature band (cattle) for the smart flag. */
const TEMP_NORMAL = { min: 38.0, max: 39.3 };

/**
 * Auto-derive the visit status from the inputs (design: "Status & Save" banner).
 * Urgent = serious condition or clearly abnormal vitals; Monitor = a mild issue,
 * treatment in progress, or flagged for recheck; Healthy = otherwise.
 */
export function deriveScorecardStatus(input: {
  vitals: ScorecardVitals;
  diagnosisTags: string[];
  diagnosisNotes?: string | null;
  treatment: ScorecardTreatment;
  flagRecheck: boolean;
}): ScorecardStatus {
  const { vitals, diagnosisTags, diagnosisNotes, treatment, flagRecheck } = input;
  const bcs = vitals.bcs;
  const temp = vitals.temperature;
  const tempAbnormal = typeof temp === 'number' && (temp < TEMP_NORMAL.min - 0.7 || temp > TEMP_NORMAL.max + 0.7);
  const serious = ['Mastitis', 'Respiratory', 'Bloat', 'Foot rot'];
  const hasSerious = diagnosisTags.some((t) => serious.includes(t));

  if ((typeof bcs === 'number' && bcs <= 2) || tempAbnormal || hasSerious) return 'urgent';

  const hasDiagnosis = diagnosisTags.length > 0 || !!(diagnosisNotes && diagnosisNotes.trim());
  const inTreatment = !!(treatment.drug && treatment.drug.trim());
  const midBcs = typeof bcs === 'number' && bcs > 2 && bcs < 3.5;
  if (hasDiagnosis || inTreatment || flagRecheck || midBcs) return 'monitor';

  return 'healthy';
}

/** Whether the temperature reading is outside the species-normal band. */
export function isTemperatureAbnormal(temp: number | null | undefined): boolean {
  return typeof temp === 'number' && (temp < TEMP_NORMAL.min || temp > TEMP_NORMAL.max);
}

export const STATUS_LABEL: Record<ScorecardStatus, string> = {
  healthy: 'Healthy',
  monitor: 'Monitor',
  urgent: 'Urgent',
};

export async function getScorecards(): Promise<Scorecard[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const all: Scorecard[] = raw ? (JSON.parse(raw) as Scorecard[]) : [];
    return all.sort((a, b) => (a.date < b.date ? 1 : -1));
  } catch {
    return [];
  }
}

/** Scorecards for one animal, keyed by ngaren code / tag / account / name. */
export async function getScorecardsForAnimal(keys: string[]): Promise<Scorecard[]> {
  const wanted = keys.filter(Boolean).map((k) => k.toLowerCase());
  const all = await getScorecards();
  return all.filter((s) => wanted.includes(s.animalKey.toLowerCase()) || wanted.includes(s.animalLabel.toLowerCase()));
}

export async function getScorecardById(id: string): Promise<Scorecard | undefined> {
  return (await getScorecards()).find((s) => s.id === id);
}

export async function addScorecard(input: Omit<Scorecard, 'id' | 'createdAt' | 'locked'>): Promise<Scorecard> {
  const record: Scorecard = { ...input, id: `sc-${Date.now()}`, createdAt: new Date().toISOString(), locked: true };
  try {
    const existing = await getScorecards();
    await AsyncStorage.setItem(KEY, JSON.stringify([record, ...existing]));
  } catch {
    // best-effort — a storage failure shouldn't lose the vet's work silently
    throw new Error('Could not save the scorecard');
  }
  return record;
}

/**
 * Write-through a locked scorecard to Supabase (drained by the offline sync
 * queue). Idempotent: the client id is the primary key, so a scorecard that is
 * already stored is treated as success and never duplicated on retry. Returns
 * true on success (drop from queue) or false to retry later.
 */
export async function syncScorecardToSupabase(card: Scorecard, userId?: string): Promise<boolean> {
  // Nowhere to sync (no backend) — the local copy is the record; drop the op.
  if (!isSupabaseConfigured()) return true;
  if (!userId) return false; // need an author for RLS; keep and retry.
  try {
    const { data: existing, error: selErr } = await supabase
      .from('livestock_scorecards')
      .select('id')
      .eq('id', card.id)
      .maybeSingle();
    if (selErr) return false; // e.g. table not yet migrated — keep & retry.
    if (existing) return true; // already synced (locked records never change).

    const row = {
      id: card.id,
      animal_key: card.animalKey,
      animal_label: card.animalLabel,
      farm_name: card.farmName ?? null,
      breed: card.breed ?? null,
      status: card.status,
      visit_type: card.visitType,
      vitals: card.vitals,
      diagnosis_tags: card.diagnosisTags,
      diagnosis_notes: card.diagnosisNotes ?? null,
      treatment: card.treatment,
      grooming: card.grooming,
      pregnancy: card.pregnancy ?? null,
      notes: card.notes ?? null,
      flag_recheck: card.flagRecheck,
      photo_url: card.photo ?? null,
      vet_name: card.vetName,
      vet_id: card.vetId ?? null,
      farmer_id: card.farmerId ?? null,
      visit_date: card.date || null,
      locked: true,
      created_by_user: userId,
    };
    const { error } = await supabase.from('livestock_scorecards').insert(row);
    return !error;
  } catch {
    return false;
  }
}
