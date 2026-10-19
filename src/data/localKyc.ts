/**
 * User KYC submissions (Oct 2026, section B). After a user creates their account
 * they capture a facial ID + ID document; the submission is sent to Ngaren for
 * review and approved via the maker-checker process by Admin Support. Stored
 * on-device; becomes a write-through to the KYC backend when it lands.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ngaren.local.kyc.v1';

export type KycStatus = 'pending' | 'approved' | 'rejected';

export interface KycSubmission {
  id: string;
  name: string;
  email: string;
  phone?: string;
  idPhoto?: string | null;
  selfie?: string | null;
  status: KycStatus;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export async function getKycSubmissions(): Promise<KycSubmission[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as KycSubmission[]) : [];
  } catch {
    return [];
  }
}

export async function getPendingKyc(): Promise<KycSubmission[]> {
  return (await getKycSubmissions()).filter((k) => k.status === 'pending');
}

export async function addKycSubmission(input: {
  name: string;
  email: string;
  phone?: string;
  idPhoto?: string | null;
  selfie?: string | null;
}): Promise<void> {
  const record: KycSubmission = {
    id: `kyc-${Date.now()}`,
    name: input.name,
    email: input.email.toLowerCase(),
    phone: input.phone,
    idPhoto: input.idPhoto ?? null,
    selfie: input.selfie ?? null,
    status: 'pending',
    submittedAt: new Date().toISOString(),
  };
  try {
    const all = await getKycSubmissions();
    // De-dupe by email — keep the latest submission.
    const next = [record, ...all.filter((k) => k.email !== record.email)];
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // best-effort
  }
}

export async function setKycStatus(id: string, status: KycStatus, reviewedBy: string): Promise<void> {
  try {
    const all = await getKycSubmissions();
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify(all.map((k) => (k.id === id ? { ...k, status, reviewedBy, reviewedAt: new Date().toISOString() } : k))),
    );
  } catch {
    // best-effort
  }
}
