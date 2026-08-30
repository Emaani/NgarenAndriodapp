import { Platform, ToastAndroid, Alert } from 'react-native';

/**
 * Lightweight, dependency-free user feedback. On Android (the shipping target)
 * this uses the native Toast; elsewhere it falls back to a transient Alert.
 *
 * Purpose (robustness): make best-effort writes honest — the user should hear
 * when something saved, queued, or failed, instead of silent no-ops.
 */
export function notify(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    // No native toast on iOS/web — a title-less alert is the least intrusive.
    Alert.alert('', message);
  }
}

export function notifyLong(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.LONG);
  } else {
    Alert.alert('', message);
  }
}
