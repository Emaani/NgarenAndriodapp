/**
 * Network connectivity awareness.
 *
 * The app previously had no concept of being offline — a failed call just fell
 * back to mock data silently. This exposes the real connection state so the UI
 * can tell the user plainly when they're offline, which in the field (rural,
 * intermittent coverage) is the dominant failure mode.
 */
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * True when the device has a usable internet connection. Starts optimistic
 * (true) so the UI doesn't flash an offline banner before the first probe.
 * `isInternetReachable` can be null while unknown — only an explicit false is
 * treated as offline to avoid false alarms.
 */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const reachable = state.isInternetReachable;
      setOnline(Boolean(state.isConnected) && reachable !== false);
    });
    return unsubscribe;
  }, []);

  return online;
}
