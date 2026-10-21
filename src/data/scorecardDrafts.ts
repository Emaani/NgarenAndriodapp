/**
 * Animal Health Scorecard autosave (Oct 20 2026 vet spec 3.7). While the vet is
 * filling a scorecard it is continuously saved here under a stable unique id so
 * the record carries a "Scorecard in progress" status and can be resumed/edited.
 * On final Submit the draft is cleared and becomes a locked Scorecard.
 *
 * On-device only (AsyncStorage) — an in-progress draft is the authoring device's
 * working copy; it never syncs. The unique id combines vet + animal + the time
 * the draft was opened, so two vets (or two visits) never collide.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DiagnosticEntry,
  GroomingRatings,
  ScorecardTreatment,
  ScorecardVitals,
  VaccinationEntry,
  VaccinationSchedule,
} from './scorecards';

const KEY = 'ngaren.vet.scorecard.drafts.v1';

export interface ScorecardDraft {
  id: string;
  animalKey: string;
  animalLabel: string;
  vetId?: string | null;
  vetName?: string | null;
  visitType?: string;
  vitals?: Partial<ScorecardVitals>;
  diagnostics?: DiagnosticEntry[];
  vaccinations?: VaccinationEntry[];
  vaccinationSchedule?: VaccinationSchedule | null;
  grooming?: string[];
  groomingRatings?: GroomingRatings;
  treatment?: ScorecardTreatment;
  pregnancyApplies?: boolean;
  inCalf?: boolean | null;
  calvingDue?: string;
  notes?: string;
  flagRecheck?: boolean;
  photo?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Build the stable draft id for a vet + animal visit opened "now". */
export function makeDraftId(vetId: string | null | undefined, animalKey: string): string {
  const v = (vetId ?? 'vet').replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
  const a = animalKey.replace(/[^A-Za-z0-9]/g, '').slice(0, 10);
  return `scd-${v}-${a}-${Date.now()}`;
}

export async function getScorecardDrafts(): Promise<ScorecardDraft[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ScorecardDraft[]).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)) : [];
  } catch {
    return [];
  }
}

export async function getScorecardDraft(id: string): Promise<ScorecardDraft | undefined> {
  return (await getScorecardDrafts()).find((d) => d.id === id);
}

export async function saveScorecardDraft(
  draft: Omit<ScorecardDraft, 'createdAt' | 'updatedAt'> & Partial<Pick<ScorecardDraft, 'createdAt'>>,
): Promise<void> {
  try {
    const all = await getScorecardDrafts();
    const now = new Date().toISOString();
    const existing = all.find((d) => d.id === draft.id);
    const record: ScorecardDraft = { ...draft, createdAt: existing?.createdAt ?? draft.createdAt ?? now, updatedAt: now };
    await AsyncStorage.setItem(KEY, JSON.stringify([record, ...all.filter((d) => d.id !== draft.id)]));
  } catch {
    // best-effort autosave
  }
}

export async function deleteScorecardDraft(id: string): Promise<void> {
  try {
    const all = await getScorecardDrafts();
    await AsyncStorage.setItem(KEY, JSON.stringify(all.filter((d) => d.id !== id)));
  } catch {
    // best-effort
  }
}
