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
import { uploadPhoto } from '../lib/imageUpload';

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

/**
 * Scorecards for one animal (local + remote, RLS-scoped), keyed by ngaren code
 * / tag / account / name.
 */
export async function getScorecardsForAnimal(keys: string[]): Promise<Scorecard[]> {
  const wanted = keys.filter(Boolean).map((k) => k.toLowerCase());
  const all = await loadScorecards();
  return all.filter((s) => wanted.includes(s.animalKey.toLowerCase()) || wanted.includes(s.animalLabel.toLowerCase()));
}

/** Map a Supabase `livestock_scorecards` row back to a Scorecard. */
function rowToScorecard(r: Record<string, unknown>): Scorecard {
  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
  return {
    id: String(r.id),
    animalKey: str(r.animal_key) ?? '',
    animalLabel: str(r.animal_label) ?? '',
    farmName: str(r.farm_name) ?? null,
    breed: str(r.breed) ?? null,
    farmerId: str(r.farmer_id) ?? null,
    status: (str(r.status) as ScorecardStatus) ?? 'healthy',
    visitType: str(r.visit_type) ?? '',
    vitals: (r.vitals as Scorecard['vitals']) ?? { bcs: null },
    diagnosisTags: Array.isArray(r.diagnosis_tags) ? (r.diagnosis_tags as string[]) : [],
    diagnosisNotes: str(r.diagnosis_notes) ?? null,
    treatment: (r.treatment as Scorecard['treatment']) ?? {},
    grooming: Array.isArray(r.grooming) ? (r.grooming as string[]) : [],
    pregnancy: (r.pregnancy as Scorecard['pregnancy']) ?? null,
    notes: str(r.notes) ?? null,
    flagRecheck: r.flag_recheck === true,
    photo: str(r.photo_url) ?? null,
    vetName: str(r.vet_name) ?? 'Vet',
    vetId: str(r.vet_id) ?? null,
    date: str(r.visit_date) ?? str(r.created_at)?.slice(0, 10) ?? '',
    createdAt: str(r.created_at) ?? '',
    locked: true,
  };
}

/**
 * Read scorecards the current user is allowed to see from Supabase. RLS scopes
 * this automatically: admins get all, a vet gets their own, and a FARMER gets
 * the scorecards recorded for their own animals — which is how a farmer sees a
 * record the vet captured on a different device. Empty when offline / not
 * configured (the local copy still shows).
 */
export async function fetchRemoteScorecards(): Promise<Scorecard[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from('livestock_scorecards')
      .select('*')
      .order('visit_date', { ascending: false })
      .limit(500);
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(rowToScorecard);
  } catch {
    return [];
  }
}

/**
 * The scorecards to DISPLAY: local (this device's own) merged with remote (RLS-
 * scoped) — deduped by id, newest first. This is what the Health Score Card
 * reads, so farmers and cross-device vets see records they didn't author.
 */
export async function loadScorecards(): Promise<Scorecard[]> {
  const [local, remote] = await Promise.all([getScorecards(), fetchRemoteScorecards()]);
  const byId = new Map<string, Scorecard>();
  for (const s of remote) byId.set(s.id, s);
  for (const s of local) byId.set(s.id, s); // local wins for its own records
  return [...byId.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getScorecardById(id: string): Promise<Scorecard | undefined> {
  const local = (await getScorecards()).find((s) => s.id === id);
  if (local) return local;
  // Fall back to the shared store (e.g. a farmer opening a vet-authored record).
  if (!isSupabaseConfigured()) return undefined;
  try {
    const { data, error } = await supabase.from('livestock_scorecards').select('*').eq('id', id).maybeSingle();
    if (error || !data) return undefined;
    return rowToScorecard(data as Record<string, unknown>);
  } catch {
    return undefined;
  }
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

    // Upload a live diagnosis photo to Storage first, so the DB only ever holds
    // a durable URL — never a device-only file URI. Retry if the upload fails.
    let photoUrl = card.photo ?? null;
    if (photoUrl && !/^https?:\/\//.test(photoUrl)) {
      const uploaded = await uploadPhoto(photoUrl, `${userId}/scorecards/${card.id}.jpg`);
      if (!uploaded) return false; // keep & retry — don't persist a dangling URI.
      photoUrl = uploaded;
    }

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
      photo_url: photoUrl,
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
