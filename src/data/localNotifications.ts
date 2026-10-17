/**
 * In-app notifications raised by the app itself (Oct 2026) — e.g. an animal
 * deletion notifying the Ngaren Admin. Stored on-device and merged into the
 * notifications list + unread bell count, so the recipient sees them in-app.
 * (Cross-device delivery + email require the notifications backend.)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppNotification, NotificationCategory } from './types';

const KEY = 'ngaren.local.notifications.v1';

export async function getLocalNotifications(): Promise<AppNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AppNotification[]) : [];
  } catch {
    return [];
  }
}

export async function addLocalNotification(input: {
  category?: NotificationCategory;
  title: string;
  message: string;
}): Promise<void> {
  const record: AppNotification = {
    id: Date.now(),
    category: input.category ?? 'device',
    title: input.title,
    message: input.message,
    timestamp: 'Just now',
    unread: true,
  };
  try {
    const all = await getLocalNotifications();
    await AsyncStorage.setItem(KEY, JSON.stringify([record, ...all].slice(0, 100)));
  } catch {
    // best-effort
  }
}
