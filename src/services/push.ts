/**
 * Push notification service (expo-notifications, SDK 56).
 *
 * Responsibilities:
 *  - Configure how notifications are presented while the app is foregrounded.
 *  - Request OS permission, create the Android "alerts" channel, obtain the
 *    Expo push token and register it with the backend (src/data/api.ts).
 *  - Route taps on a notification to the right in-app screen.
 *
 * Everything degrades gracefully: it no-ops on web/simulators and swallows the
 * (expected) token error when no EAS projectId is configured, so the app keeps
 * running in mock mode.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { registerPushToken } from '../data/api';

// How notifications appear while the app is in the foreground. SDK 56 replaced
// the deprecated `shouldShowAlert` with the explicit banner/list fields.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const ANDROID_CHANNEL_ID = 'alerts';

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1F8A4C',
  });
}

export type PushPermission = 'granted' | 'denied' | 'undetermined';

/** Current OS notification-permission status, without prompting. */
export async function getPushPermissionStatus(): Promise<PushPermission> {
  if (Platform.OS === 'web') return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

/**
 * Turn push on: ensure the Android channel, request permission if needed, and
 * (best-effort) register the Expo push token with the backend. Returns whether
 * push is now enabled (permission granted) — decoupled from whether a token was
 * obtained, so the toggle reflects the user's real permission state rather than
 * flipping off just because there's no EAS projectId or backend yet.
 */
export async function enablePushNotifications(): Promise<PushPermission> {
  if (Platform.OS === 'web') return 'denied';
  await ensureAndroidChannel();

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') {
    return status === 'denied' ? 'denied' : 'undetermined';
  }

  // Permission is granted — try to obtain and register the token, but never let
  // a missing projectId / backend downgrade the user's enabled state.
  registerForPushNotifications().catch(() => {});
  return 'granted';
}

/**
 * Request permission, obtain the Expo push token and register it with the
 * backend. Returns the token when successful, otherwise null.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push tokens require a physical device; skip web and simulators.
  if (Platform.OS === 'web' || !Device.isDevice) {
    return null;
  }

  await ensureAndroidChannel();

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') {
    return null;
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse.data;
    await registerPushToken(token, Platform.OS as 'ios' | 'android');
    return token;
  } catch (err) {
    // Expected when no EAS projectId is configured yet — don't crash the app.
    console.warn('Push token registration skipped:', err);
    return null;
  }
}

/** Boundary alerts open the map; everything else opens the notification center. */
function routeForNotification(data: { type?: string } | undefined): void {
  if (data?.type === 'BOUNDARY_CHECK') {
    router.push('/(tabs)/track');
  } else {
    router.push('/notifications');
  }
}

/**
 * Wire a listener so tapping a notification deep-links into the app while the
 * app is running (foregrounded or backgrounded). Returns an unsubscribe function.
 */
export function addNotificationResponseListener(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { type?: string } | undefined;
    routeForNotification(data);
  });
  return () => sub.remove();
}

/**
 * Handle the case where tapping a notification launched the app from fully
 * killed (not just backgrounded) — addNotificationResponseListener's callback
 * never fires for that launch since it's registered after the tap already
 * happened. Call once on root mount.
 */
export async function routeColdStartNotification(): Promise<void> {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return;
    const data = response.notification.request.content.data as { type?: string } | undefined;
    routeForNotification(data);
  } catch (error) {
    console.warn('Cold-start notification routing skipped:', error);
  }
}
