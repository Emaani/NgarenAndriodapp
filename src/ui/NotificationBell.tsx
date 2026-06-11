import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors } from '@/theme';
import { getUnreadCount } from '@/data/api';
import { AppText } from './AppText';
import { Icon } from './Icon';

/**
 * Header bell that opens the notification center and shows an unread-count
 * badge. Refreshes the count whenever the host screen regains focus, so the
 * badge clears after the user visits notifications.
 */
export function NotificationBell({ tint = '#fff' }: { tint?: string }) {
  const router = useRouter();
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getUnreadCount()
        .then((c) => {
          if (active) setCount(c);
        })
        .catch(() => {
          if (active) setCount(0);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <Pressable onPress={() => router.push('/notifications')} hitSlop={8}>
      <Icon name="bell-outline" size={26} color={tint} />
      {count > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -6,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            paddingHorizontal: 4,
            backgroundColor: colors.error,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <AppText style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
            {count > 9 ? '9+' : count}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}
