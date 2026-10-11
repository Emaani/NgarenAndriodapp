import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { useT } from '@/i18n';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

/**
 * A single dashboard action. `label` holds an i18n key (translated at render),
 * so every grid switches language with the rest of the app.
 */
export type GridAction = { icon: IconName; label: string; route: string; tint: string };

/**
 * The canonical dashboard "quick actions / tools" grid — two-column cards with
 * an icon chip on top and a label below. Shared by every role's dashboard
 * (farmer home, vet, admin) so Quick Actions and Tools render identically
 * across profiles and stay visually consistent as the app grows.
 */
export function ActionGrid({ actions }: { actions: GridAction[] }) {
  const router = useRouter();
  const t = useT();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      {actions.map((a) => (
        <Pressable
          key={a.label}
          onPress={() => router.push(a.route as never)}
          style={({ pressed }) => [
            {
              width: '47%',
              flexGrow: 1,
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.md,
              gap: spacing.sm,
              opacity: pressed ? 0.9 : 1,
            },
            shadow[1],
          ]}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radius.md,
              backgroundColor: a.tint + '1A',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name={a.icon} size={26} color={a.tint} />
          </View>
          <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
            {t(a.label)}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
