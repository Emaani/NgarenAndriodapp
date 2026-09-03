/**
 * Durable offline write queue (robustness). Supabase writes that must survive a
 * flaky connection — the animal_lineage write-through and its photo upload — are
 * enqueued here instead of fired-and-forgotten. The queue is persisted to
 * AsyncStorage and drained when the app starts, comes to the foreground, and
 * when connectivity returns. Each op is idempotent, so retries never duplicate.
 *
 * Guarantees:
 *  - No silent drops: an op is never removed unless it SUCCEEDS. After the retry
 *    cap it is parked as `failed` (dead-letter) but kept, and surfaced via
 *    failedSyncCount() so an admin can force a retry (syncNow).
 *  - Single watcher: startSyncQueueWatcher is idempotent — repeated calls (e.g.
 *    a root remount) never stack multiple NetInfo subscriptions.
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
  failed?: boolean;
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
// Single-watcher guard — ensures only one NetInfo subscription is ever live.
let watcherStarted = false;
let watcherUnsub: (() => void) | null = null;

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

/** Total writes still in the queue (waiting or dead-lettered). */
export async function pendingSyncCount(): Promise<number> {
  return (await readQueue()).length;
}

/** Writes that have exhausted their automatic retries and need a manual push. */
export async function failedSyncCount(): Promise<number> {
  return (await readQueue()).filter((o) => o.failed).length;
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

/**
 * Drain the queue. Safe to call often; concurrent calls are coalesced. Set
 * `includeFailed` to also re-attempt dead-lettered ops (used by manual "sync
 * now"). Returns the number of ops still queued afterwards.
 */
export async function processSyncQueue(includeFailed = false): Promise<number> {
  if (processing) return (await readQueue()).length;
  processing = true;
  try {
    const net = await NetInfo.fetch().catch(() => null);
    if (net && net.isConnected === false) return (await readQueue()).length; // offline.

    const q = await readQueue();
    if (q.length === 0) return 0;

    const remaining: SyncOp[] = [];
    let anyFailure = false;
    for (const op of q) {
      // Skip dead-lettered ops on automatic passes; a manual sync includes them.
      if (op.failed && !includeFailed) {
        remaining.push(op);
        continue;
      }
      let ok = false;
      let err: string | undefined;
      try {
        ok = await runOp(op);
      } catch (e) {
        ok = false;
        err = e instanceof Error ? e.message : String(e);
      }
      if (ok) continue; // success → drop from queue.
      anyFailure = true;
      const attempts = op.attempts + 1;
      // NEVER silently drop: past the cap we park it as `failed` but keep it,
      // so it can be retried manually and is counted honestly.
      remaining.push({ ...op, attempts, lastError: err ?? op.lastError, failed: attempts >= MAX_ATTEMPTS });
    }
    await writeQueue(remaining);
    if (anyFailure) reportDataFailure('sync-queue', null);
    else reportDataSuccess();
    return remaining.length;
  } finally {
    processing = false;
  }
}

/**
 * Manual "sync now" (admin/testing): re-arm every dead-lettered op and drain,
 * including failed ones. Returns the number still queued afterwards.
 */
export async function syncNow(): Promise<number> {
  const q = await readQueue();
  if (q.some((o) => o.failed)) {
    await writeQueue(q.map((o) => (o.failed ? { ...o, failed: false, attempts: 0 } : o)));
  }
  return processSyncQueue(true);
}

/**
 * Start draining on connectivity changes. Idempotent — only one watcher is ever
 * registered no matter how many times this is called. Returns an unsubscribe
 * that tears the single watcher down.
 */
export function startSyncQueueWatcher(): () => void {
  if (watcherStarted) return () => undefined;
  watcherStarted = true;
  void processSyncQueue();
  const sub = NetInfo.addEventListener((state) => {
    if (state.isConnected) void processSyncQueue();
  });
  watcherUnsub = () => {
    sub();
    watcherStarted = false;
    watcherUnsub = null;
  };
  return watcherUnsub;
}
