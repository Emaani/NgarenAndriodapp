/**
 * Vet field-visit log.
 *
 * Lets a veterinarian validate a field visit — findings, animal status, and a
 * confirmation photo proving presence — as required by Horizon One. Stored
 * on-device (AsyncStorage) for the prototype; the same shape maps onto a
 * `vet_visits` table / vet_support_requests.vet_notes when the backend lands.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ngaren.vet.visits.v1';

export type VisitOutcome = 'healthy' | 'treated' | 'follow_up';

export interface VetVisit {
  id: string;
  animal: string; // tag or name
  outcome: VisitOutcome;
  findings: string;
  photo: string | null; // confirmation photo URI
  vetName: string;
  loggedAt: string; // ISO
}

export async function getVetVisits(): Promise<VetVisit[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as VetVisit[]) : [];
  } catch {
    return [];
  }
}

export async function addVetVisit(visit: Omit<VetVisit, 'id' | 'loggedAt'>): Promise<VetVisit> {
  const record: VetVisit = { ...visit, id: `visit-${Date.now()}`, loggedAt: new Date().toISOString() };
  try {
    const existing = await getVetVisits();
    await AsyncStorage.setItem(KEY, JSON.stringify([record, ...existing]));
  } catch {
    // best-effort
  }
  return record;
}

export const OUTCOME_LABELS: Record<VisitOutcome, string> = {
  healthy: 'Healthy',
  treated: 'Treated',
  follow_up: 'Needs follow-up',
};
