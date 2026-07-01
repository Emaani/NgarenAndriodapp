/**
 * Background Ceres Tag sync (expo-background-task, SDK 56).
 *
 * Periodically wakes the app in the background to trigger the same
 * `GET /api/sync/devices` the web app's "Sync Devices" button calls, so device
 * telemetry and boundary alerts stay fresh even when the farmer hasn't opened
 * the app. No-ops in mock mode (isBackendConfigured() === false) and on
 * web/simulators, matching the rest of the data layer's degrade-gracefully
 * pattern.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { isBackendConfigured } from '../config';
import { syncDevices } from '../data/api';

const BACKGROUND_SYNC_TASK = 'ngaren-background-sync';

// Task Manager requires the task to be defined at module scope (not inside a
// component), so it can be re-registered by the OS after a cold start.
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    if (!isBackendConfigured()) return BackgroundTask.BackgroundTaskResult.Success;
    await syncDevices();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.warn('Background Ceres sync failed:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Register the periodic sync. Safe to call on every app start — registering
 * an already-registered task is a no-op. The OS decides the actual cadence;
 * `minimumInterval` is a floor, not a guarantee (15 min is the platform min).
 */
export async function registerBackgroundSyncAsync(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (isRegistered) return;
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 15,
    });
  } catch (error) {
    // Expected on simulators/web where background tasks aren't supported.
    console.warn('Background sync registration skipped:', error);
  }
}

/** Unregister the periodic sync, e.g. on sign-out. */
export async function unregisterBackgroundSyncAsync(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (!isRegistered) return;
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
  } catch (error) {
    console.warn('Background sync unregister skipped:', error);
  }
}
