/**
 * Vet self-enlisting (Oct 20 2026 vet spec 1). A veterinarian maintains their
 * OWN professional profile and uploads the required documents (practising
 * licence, ID, certificates). The submission goes to Ngaren for maker-checker
 * approval; the vet is only "active" in the app once an admin approves it.
 *
 * Distinct from `vetEnlistments` (admin-created LISTINGS) and `localProviderStatus`
 * (admin-driven lifecycle of a listing). This is the vet's own, document-backed
 * enlisting request, keyed by the vet's auth user id. On-device (AsyncStorage);
 * becomes a backend write-through to a vet-registry table when it lands.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ngaren.vet.selfprofile.v1';

export type VetProfileStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface VetDocument {
  id: string;
  label: string;
  uri: string;
}

export interface VetSelfProfile {
  vetId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  /** Licence number / qualifications (e.g. "BVM, Reg. #12345"). */
  credentials?: string | null;
  specialty?: string | null;
  clinic?: string | null;
  city?: string | null;
  bio?: string | null;
  documents: VetDocument[];
  status: VetProfileStatus;
  submittedAt?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  updatedAt: string;
}

export async function getAllVetProfiles(): Promise<VetSelfProfile[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as VetSelfProfile[]) : [];
  } catch {
    return [];
  }
}

export async function getVetProfile(vetId: string): Promise<VetSelfProfile | undefined> {
  return (await getAllVetProfiles()).find((p) => p.vetId === vetId);
}

export async function saveVetProfile(
  profile: Omit<VetSelfProfile, 'updatedAt'> & Partial<Pick<VetSelfProfile, 'updatedAt'>>,
): Promise<VetSelfProfile> {
  const all = await getAllVetProfiles();
  const record: VetSelfProfile = { ...profile, updatedAt: new Date().toISOString() };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify([record, ...all.filter((p) => p.vetId !== profile.vetId)]));
  } catch {
    // best-effort
  }
  return record;
}

/** Move the vet's profile into Ngaren review (pending). */
export async function submitVetProfile(vetId: string): Promise<void> {
  const all = await getAllVetProfiles();
  const now = new Date().toISOString();
  try {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify(all.map((p) => (p.vetId === vetId ? { ...p, status: 'pending' as const, submittedAt: now, updatedAt: now, rejectionReason: null } : p))),
    );
  } catch {
    // best-effort
  }
}

export async function setVetProfileReview(
  vetId: string,
  status: 'approved' | 'rejected',
  reviewedBy: string,
  rejectionReason?: string,
): Promise<void> {
  const all = await getAllVetProfiles();
  const now = new Date().toISOString();
  try {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify(
        all.map((p) =>
          p.vetId === vetId
            ? { ...p, status, reviewedBy, reviewedAt: now, updatedAt: now, rejectionReason: status === 'rejected' ? rejectionReason ?? null : null }
            : p,
        ),
      ),
    );
  } catch {
    // best-effort
  }
}
