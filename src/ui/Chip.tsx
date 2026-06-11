import { View } from 'react-native';
import { colors, radius, spacing, type } from '@/theme';
import { AppText } from './AppText';

type Variant = 'success' | 'warning' | 'error' | 'neutral' | 'info';

const map: Record<Variant, { fg: string; bg: string }> = {
  success: { fg: colors.success, bg: colors.successTint },
  warning: { fg: colors.warning, bg: colors.warningTint },
  error: { fg: colors.error, bg: colors.errorTint },
  info: { fg: colors.info, bg: colors.infoTint },
  neutral: { fg: colors.onSurfaceVariant, bg: colors.background },
};

export function ActionChip({
  label,
  variant = 'neutral',
  dot = true,
}: {
  label: string;
  variant?: Variant;
  dot?: boolean;
}) {
  const c = map[variant];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: c.bg,
        borderRadius: radius.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        gap: spacing.xs,
      }}>
      {dot && (
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.fg }} />
      )}
      <AppText style={{ ...type.caption, color: c.fg, fontWeight: '600' }}>{label}</AppText>
    </View>
  );
}
