import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';
import { useIsOnline } from '@/services/connectivity';
import { useDataStale } from '@/services/dataHealth';
import { AppText } from './AppText';
import { Icon } from './Icon';

/**
 * A thin status strip pinned under the status bar. It appears only when there
 * is something honest to say:
 *   - offline: the device has no connection
 *   - stale:   a live fetch failed, so on-screen values may not be current
 *
 * Offline takes precedence (it explains the staleness). When neither is true
 * the banner renders nothing and takes no space.
 */
export function StatusBanner() {
  const insets = useSafeAreaInsets();
  const online = useIsOnline();
  const stale = useDataStale();

  if (online && !stale) return null;

  const offline = !online;
  const bg = offline ? '#B91C1C' : colors.warning;
  const icon = offline ? 'wifi-off' : 'cloud-alert';
  const message = offline
    ? 'You’re offline — showing the last saved data'
    : 'Couldn’t refresh — showing the last known data';

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: bg,
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.md,
        }}>
        <Icon name={icon} size={14} color="#fff" />
        <AppText variant="caption" color="#fff" style={{ fontWeight: '600' }}>
          {message}
        </AppText>
      </View>
    </View>
  );
}
