/**
 * Durable offline write queue (robustness). Supabase writes that must survive a
 * flaky connection — the animal_lineage write-through and its photo upload — are
 * enqueued here instead of fired-and-forgotten. The queue is persisted to
 * AsyncStorage and drained when the app starts, comes to the foreground, and
 * when connectivity returns. Each op is idempotent, so retries never duplicate.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Animal } from './types';
import { syncAnimalToLineage } from './herd';
import { uploadAnimalPhotos } from '../lib/imageUpload';
import { reportDataFailure, reportDataSuccess } from '../services/dataHealth';

const KEY = 'ngaren.sync.queue.v1';
const MAX_ATTEMPTS = 8;

interface AnimalSyncOp {
  id: string;
  type: 'animalSync';
  attempts: number;
  createdAt: string;
  lastError?: string;
  payload: {
    animal: Animal;
    userId?: string;
    /** Local file URIs still to upload; http(s) urls are already-uploaded. */
    photoUris: string[];
    aan: string;
  };
}

export type SyncOp = AnimalSyncOp;

let processing = false;

async function readQueue(): Promise<SyncOp[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SyncOp[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(ops: SyncOp[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(ops));
  } catch {
    // Best-effort persistence.
  }
}

/** Number of writes still waiting to sync (for a UI indicator). */
export async function pendingSyncCount(): Promise<number> {
  return (await readQueue()).length;
}

/** Enqueue an animal registration to be written through to Supabase. */
export async function enqueueAnimalSync(input: {
  animal: Animal;
  userId?: string;
  photoUris: string[];
  aan: string;
}): Promise<void> {
  const op: AnimalSyncOp = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'animalSync',
    attempts: 0,
    createdAt: new Date().toISOString(),
    payload: input,
  };
  const q = await readQueue();
  await writeQueue([...q, op]);
}

/** Run a single op. Returns true on success (remove) or false (keep & retry). */
async function runOp(op: SyncOp): Promise<boolean> {
  if (op.type === 'animalSync') {
    const { animal, userId, photoUris, aan } = op.payload;
    if (!userId) return true; // nothing we can do without an owner; drop it.
    // Upload any local photos first; already-http urls pass straight through.
    const locals = photoUris.filter((p) => !/^https?:\/\//.test(p));
    const alreadyRemote = photoUris.filter((p) => /^https?:\/\//.test(p));
    let uploaded: string[] = alreadyRemote;
    if (locals.length) {
      const urls = await uploadAnimalPhotos(locals, userId, aan);
      // If we expected uploads but got none, the upload failed — retry later.
      if (urls.length === 0) return false;
      uploaded = [...alreadyRemote, ...urls];
    }
    return syncAnimalToLineage(animal, userId, uploaded);
  }
  return true;
}

/** Drain the queue. Safe to call often; concurrent calls are coalesced. */
export async function processSyncQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    const net = await NetInfo.fetch().catch(() => null);
    if (net && net.isConnected === false) return; // offline — try again later.

    let q = await readQueue();
    if (q.length === 0) return;

    const remaining: SyncOp[] = [];
    let anyFailure = false;
    for (const op of q) {
      let ok = false;
      try {
        ok = await runOp(op);
      } catch (e) {
        ok = false;
        op.lastError = e instanceof Error ? e.message : String(e);
      }
      if (ok) continue;
      anyFailure = true;
      const next = { ...op, attempts: op.attempts + 1 };
      // Keep retrying up to the cap; beyond it, keep the op but stop hammering
      // (a later manual reload / app restart can still pick it up).
      if (next.attempts <= MAX_ATTEMPTS) remaining.push(next);
      else remaining.push(next);
    }
    await writeQueue(remaining);
    if (anyFailure) reportDataFailure('sync-queue', null);
    else reportDataSuccess();
  } finally {
    processing = false;
  }
}

/**
 * Start draining on connectivity changes. Call once at app root. Returns an
 * unsubscribe. Also kicks an immediate drain for the app-start case.
 */
export function startSyncQueueWatcher(): () => void {
  void processSyncQueue();
  const unsub = NetInfo.addEventListener((state) => {
    if (state.isConnected) void processSyncQueue();
  });
  return unsub;
}
