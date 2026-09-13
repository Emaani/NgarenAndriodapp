/**
 * Classified documents module (Sep 12 2026 standup).
 *
 * A central registry of documents the app generates — Visit Scorecards,
 * practice reports, station/visit logs — with profile-based access (admins see
 * everything; a vet or farmer sees only their own) and an auto-delete retention
 * window to keep storage costs down. Persisted on-device; maps onto a future
 * documents bucket + metadata table.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ngaren.documents.v1';

/** Default retention before a document is auto-deleted. */
export const RETENTION_DAYS = 30;

export type DocumentKind = 'scorecard' | 'report' | 'station-log' | 'other';
export type OwnerRole = 'admin' | 'vet' | 'farmer';

export interface DocumentRecord {
  id: string;
  kind: DocumentKind;
  title: string;
  subject?: string | null;
  ownerRole: OwnerRole;
  ownerId?: string | null;
  createdAt: string;
  /** ISO timestamp after which the document is auto-deleted. */
  expiresAt: string;
}

export const KIND_LABEL: Record<DocumentKind, string> = {
  scorecard: 'Scorecard',
  report: 'Report',
  'station-log': 'Station log',
  other: 'Document',
};

async function readAll(): Promise<DocumentRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const all = raw ? (JSON.parse(raw) as DocumentRecord[]) : [];
    return Array.isArray(all) ? all : [];
  } catch {
    return [];
  }
}

async function writeAll(docs: DocumentRecord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(docs));
  } catch {
    // best-effort
  }
}

/** Drop any documents whose retention window has elapsed (auto-delete). */
export async function pruneExpired(): Promise<DocumentRecord[]> {
  const now = Date.now();
  const all = await readAll();
  const live = all.filter((d) => new Date(d.expiresAt).getTime() > now);
  if (live.length !== all.length) await writeAll(live);
  return live;
}

/**
 * Documents visible to the current user: admins see all; everyone else sees
 * only the documents they own. Expired documents are pruned first.
 */
export async function getVisibleDocuments(opts: { isAdmin: boolean; userId?: string | null }): Promise<DocumentRecord[]> {
  const live = await pruneExpired();
  const list = opts.isAdmin ? live : live.filter((d) => d.ownerId && d.ownerId === opts.userId);
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function addDocument(
  input: Omit<DocumentRecord, 'id' | 'createdAt' | 'expiresAt'> & { retentionDays?: number },
): Promise<void> {
  const now = new Date();
  const days = input.retentionDays ?? RETENTION_DAYS;
  const record: DocumentRecord = {
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: input.kind,
    title: input.title,
    subject: input.subject ?? null,
    ownerRole: input.ownerRole,
    ownerId: input.ownerId ?? null,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + days * 864e5).toISOString(),
  };
  const all = await readAll();
  await writeAll([record, ...all]);
}

export async function deleteDocument(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((d) => d.id !== id));
}
