import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, layout, spacing } from '@/theme';
import { Icon, IconName } from './Icon';
import { AppText } from './AppText';

export interface TopBarAction {
  icon: IconName;
  onPress: () => void;
  badge?: boolean;
}

export function TopAppBar({
  title,
  showBack,
  actions = [],
  right,
}: {
  title: string;
  showBack?: boolean;
  actions?: TopBarAction[];
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
      }}>
      <View
        style={{
          height: layout.topBarHeight,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
        }}>
        {showBack && (
          <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginRight: spacing.xs }}>
            <Icon name="arrow-left" size={24} color={colors.onSurface} />
          </Pressable>
        )}
        <AppText variant="title" style={{ flex: 1 }} numberOfLines={1}>
          {title}
        </AppText>
        {actions.map((a, i) => (
          <Pressable key={i} onPress={a.onPress} hitSlop={8} style={{ padding: spacing.xs }}>
            <View>
              <Icon name={a.icon} size={24} color={colors.onSurface} />
              {a.badge && (
                <View
                  style={{
                    position: 'absolute',
                    top: -1,
                    right: -1,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.error,
                  }}
                />
              )}
            </View>
          </Pressable>
        ))}
        {right}
      </View>
    </View>
  );
}

/** Circular avatar used on the right of the top bar. */
export function AvatarButton({ initials, onPress }: { initials: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <AppText style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{initials}</AppText>
      </View>
    </Pressable>
  );
}
