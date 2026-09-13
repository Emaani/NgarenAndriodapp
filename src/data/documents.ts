/**
 * Classified documents module (Sep 12 2026 standup).
 *
 * A central registry of documents the app generates — Visit Scorecards,
 * practice reports, station/visit logs. Each document's content (the branded
 * HTML for PDFs, or CSV/plain text) is persisted to the durable documents
 * directory so it can be previewed and re-shared later, not just fired once
 * into the OS share sheet. Metadata lives in AsyncStorage with profile-based
 * access (admins see all; a vet or farmer sees only their own) and an
 * auto-delete retention window to keep storage lean.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

const KEY = 'ngaren.documents.v1';
const DOC_DIR = 'ngaren-docs';

/** Default retention before a document is auto-deleted. */
export const RETENTION_DAYS = 30;

export type DocumentKind = 'scorecard' | 'report' | 'station-log' | 'other';
export type OwnerRole = 'admin' | 'vet' | 'farmer';
/** How the stored content should be rendered / re-shared. */
export type DocFormat = 'pdf' | 'csv' | 'text';

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
  /** Content shape — 'pdf' stores branded HTML rendered to PDF on share. */
  format?: DocFormat;
  /** file:// uri of the persisted content, when the document carries content. */
  contentPath?: string;
  /** Suggested filename for re-sharing (with extension). */
  filename?: string;
}

export const KIND_LABEL: Record<DocumentKind, string> = {
  scorecard: 'Scorecard',
  report: 'Report',
  'station-log': 'Station log',
  other: 'Document',
};

function docsDir(): Directory {
  const dir = new Directory(Paths.document, DOC_DIR);
  try {
    if (!dir.exists) dir.create({ intermediates: true });
  } catch {
    // best-effort
  }
  return dir;
}

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

/** Remove a document's on-disk content file, if any. */
function deleteContentFile(rec: DocumentRecord): void {
  if (!rec.contentPath) return;
  try {
    const f = new File(rec.contentPath);
    if (f.exists) f.delete();
  } catch {
    // best-effort
  }
}

/** Drop any documents whose retention window has elapsed (auto-delete). */
export async function pruneExpired(): Promise<DocumentRecord[]> {
  const now = Date.now();
  const all = await readAll();
  const live: DocumentRecord[] = [];
  for (const d of all) {
    if (new Date(d.expiresAt).getTime() > now) live.push(d);
    else deleteContentFile(d);
  }
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

export async function getDocumentById(id: string): Promise<DocumentRecord | undefined> {
  return (await readAll()).find((d) => d.id === id);
}

/** Read a document's stored content (branded HTML / CSV / text), or null. */
export async function readDocumentContent(rec: DocumentRecord): Promise<string | null> {
  if (!rec.contentPath) return null;
  try {
    const f = new File(rec.contentPath);
    if (!f.exists) return null;
    return await f.text();
  } catch {
    return null;
  }
}

/**
 * Register a document. When `content` is supplied it is persisted to the durable
 * documents directory so the document can be previewed and re-shared. Returns
 * the new document id.
 */
export async function addDocument(
  input: Omit<DocumentRecord, 'id' | 'createdAt' | 'expiresAt' | 'contentPath'> & {
    retentionDays?: number;
    content?: string;
  },
): Promise<string> {
  const now = new Date();
  const days = input.retentionDays ?? RETENTION_DAYS;
  const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  let contentPath: string | undefined;
  if (input.content != null) {
    try {
      const file = new File(docsDir(), `${id}.txt`);
      if (file.exists) file.delete();
      file.create();
      file.write(input.content);
      contentPath = file.uri;
    } catch {
      // If persistence fails we still keep the metadata record.
    }
  }

  const record: DocumentRecord = {
    id,
    kind: input.kind,
    title: input.title,
    subject: input.subject ?? null,
    ownerRole: input.ownerRole,
    ownerId: input.ownerId ?? null,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + days * 864e5).toISOString(),
    format: input.format,
    filename: input.filename,
    contentPath,
  };
  const all = await readAll();
  await writeAll([record, ...all]);
  return id;
}

export async function deleteDocument(id: string): Promise<void> {
  const all = await readAll();
  const rec = all.find((d) => d.id === id);
  if (rec) deleteContentFile(rec);
  await writeAll(all.filter((d) => d.id !== id));
}
