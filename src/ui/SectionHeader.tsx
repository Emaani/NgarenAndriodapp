import { Pressable, View } from 'react-native';
import { colors, spacing } from '@/theme';
import { AppText } from './AppText';

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.mdPlus,
        marginBottom: spacing.sm,
      }}>
      <AppText variant="overline" color={colors.onSurfaceVariant}>
        {title}
      </AppText>
      {actionLabel && (
        <Pressable onPress={onAction} hitSlop={8}>
          <AppText variant="label" color={colors.primary}>
            {actionLabel} →
          </AppText>
        </Pressable>
      )}
    </View>
  );
}
