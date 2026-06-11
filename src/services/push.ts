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

/**
 * Wire a listener so tapping a notification deep-links into the app. Returns an
 * unsubscribe function. Boundary alerts open the map; everything else opens the
 * notification center.
 */
export function addNotificationResponseListener(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data as
        | { type?: string }
        | undefined;
      if (data?.type === 'BOUNDARY_CHECK') {
        router.push('/(tabs)/track');
      } else {
        router.push('/notifications');
      }
    },
  );
  return () => sub.remove();
}
