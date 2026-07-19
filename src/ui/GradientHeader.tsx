import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

/**
 * Green gradient header with rounded bottom corners (Figma §header).
 * Used at the top of auth + flow screens.
 */
export function GradientHeader({
  title,
  subtitle,
  showBack,
  onBack,
  right,
  children,
  compact,
}: {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  /** Custom back handler; defaults to router.back(). */
  onBack?: () => void;
  right?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <LinearGradient
      colors={colors.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        paddingTop: insets.top + (compact ? spacing.sm : spacing.md),
        paddingBottom: compact ? spacing.md : spacing.lg,
        paddingHorizontal: spacing.md,
        borderBottomLeftRadius: radius.header,
        borderBottomRightRadius: radius.header,
      }}>
      {(showBack || right) && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 32,
          }}>
          {showBack ? (
            <Pressable onPress={() => (onBack ? onBack() : router.back())} hitSlop={8}>
              <Icon name="chevron-left" size={28} color="#fff" />
            </Pressable>
          ) : (
            <View style={{ width: 28 }} />
          )}
          {right ?? <View style={{ width: 28 }} />}
        </View>
      )}
      {title && (
        <View style={{ alignItems: 'center', gap: 2, marginTop: spacing.xs }}>
          <AppText variant="title" color="#fff" style={{ textAlign: 'center' }}>
            {title}
          </AppText>
          {subtitle && (
            <AppText variant="bodyLarge" color="rgba(255,255,255,0.92)" style={{ textAlign: 'center' }}>
              {subtitle}
            </AppText>
          )}
        </View>
      )}
      {children}
    </LinearGradient>
  );
}
