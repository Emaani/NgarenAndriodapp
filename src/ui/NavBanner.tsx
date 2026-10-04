import { Pressable, View } from 'react-native';
import { colors, radius, shadow, spacing } from '@/theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

type Variant = 'card' | 'alert';

interface NavBannerProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  /** Accent colour for the icon (and, in `alert`, the tinted background). */
  tint?: string;
  /** `card` = surface card with a tinted icon chip; `alert` = tinted call-out. */
  variant?: Variant;
  onPress: () => void;
  style?: object;
}

/**
 * A consistent tap-through banner: leading icon, title + optional subtitle, and
 * a trailing chevron. Used across dashboards (pending approvals, vet requests,
 * Documents) so every "there's something here — tap to open" prompt reads the
 * same way. Replaces the near-identical inline versions these screens grew.
 */
export function NavBanner({
  icon,
  title,
  subtitle,
  tint = colors.primary,
  variant = 'card',
  onPress,
  style,
}: NavBannerProps) {
  const isAlert = variant === 'alert';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          backgroundColor: isAlert ? tint + '1A' : colors.surface,
          borderRadius: radius.md,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: isAlert ? tint + '55' : colors.divider,
          opacity: pressed ? 0.92 : 1,
        },
        isAlert ? undefined : shadow[1],
        style,
      ]}>
      {isAlert ? (
        <Icon name={icon} size={22} color={tint} />
      ) : (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.full,
            backgroundColor: tint + '1A',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name={icon} size={22} color={tint} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>
          {title}
        </AppText>
        {!!subtitle && (
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {subtitle}
          </AppText>
        )}
      </View>
      <Icon name="chevron-right" size={22} color={colors.onSurfaceVariant} />
    </Pressable>
  );
}
