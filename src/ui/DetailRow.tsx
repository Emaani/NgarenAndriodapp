import { View } from 'react-native';
import { colors, spacing } from '@/theme';
import { AppText } from './AppText';

export function DetailRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        paddingVertical: spacing.mdMinus,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.divider,
        gap: 2,
      }}>
      <AppText variant="caption" color={colors.onSurfaceVariant} style={{ textTransform: 'uppercase' }}>
        {label}
      </AppText>
      <AppText variant="bodyLarge">{value}</AppText>
    </View>
  );
}
