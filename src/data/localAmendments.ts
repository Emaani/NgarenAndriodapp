/**
 * Pending amendments to EXISTING animal records, proposed by a vet (or admin)
 * on-site and awaiting the farmer's review & approval (Oct 2026 Q&A 4.1).
 *
 * A vet may amend an animal's details during a visit, but the change is not
 * applied until the farmer approves it — and the AAN (ngarenCode) can never be
 * changed. On approval the patch is applied to the on-device animal record; the
 * amendment itself is kept as an audit trail.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animal } from './types';

const KEY = 'ngaren.local.amendments.v1';

/** A single field change inside an amendment (for display). */
export interface FieldChange {
  field: string;
  label: string;
  before: string;
  after: string;
}

export interface AnimalAmendment {
  id: string;
  /** The existing animal's id. */
  animalId: number;
  /** The AAN / internal code — shown for reference, never changed. */
  animalKey: string;
  /** Human label (name or tag). */
  animalLabel: string;
  /** The changed fields, for the approval review. */
  changes: FieldChange[];
  /** The patch to apply to the animal when the farmer approves. */
  patch: Partial<Animal>;
  proposedBy: string;
  proposedAt: string;
  farmerName?: string;
  status: 'pending' | 'approved' | 'rejected';
}

export async function getAmendments(): Promise<AnimalAmendment[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AnimalAmendment[]) : [];
  } catch {
    return [];
  }
}

export async function addAmendment(a: AnimalAmendment): Promise<void> {
  try {
    const all = await getAmendments();
    await AsyncStorage.setItem(KEY, JSON.stringify([a, ...all]));
  } catch {
    // best-effort
  }
}

export async function getPendingAmendments(): Promise<AnimalAmendment[]> {
  return (await getAmendments()).filter((a) => a.status === 'pending');
}

export async function setAmendmentStatus(
  id: string,
  status: 'approved' | 'rejected',
): Promise<void> {
  try {
    const all = await getAmendments();
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify(all.map((a) => (a.id === id ? { ...a, status } : a))),
    );
  } catch {
    // best-effort
  }
}
