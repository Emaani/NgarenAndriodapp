/**
 * Data-health signal.
 *
 * When a live backend is configured but a fetch fails, the data layer still
 * returns mock/last-known values so the UI stays usable — but the user must be
 * told the data may not be current, otherwise fabricated values look real. Data
 * functions call reportDataFailure() in that case; a banner subscribes here and
 * surfaces it. reportDataSuccess() clears the signal once anything loads live.
 *
 * Deliberately dependency-free (a module singleton + useSyncExternalStore) so
 * any data function can flag a failure without importing React or a context.
 */
import { useSyncExternalStore } from 'react';
import { reportError } from './sentry';

let lastFailureAt = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Flag that live data could not be fetched (stale/mock values are in use). */
export function reportDataFailure(scope: string, error?: unknown): void {
  lastFailureAt = Date.now();
  if (error) reportError(error, { scope });
  emit();
}

/** Clear the stale-data signal after a successful live fetch. */
export function reportDataSuccess(): void {
  if (lastFailureAt === 0) return;
  lastFailureAt = 0;
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const getSnapshot = () => lastFailureAt;

/** True when a recent live fetch failed and the UI may be showing stale data. */
export function useDataStale(): boolean {
  const at = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  // Treat a failure as "stale" for 30s; a later success clears it immediately.
  return at !== 0 && Date.now() - at < 30_000;
}
