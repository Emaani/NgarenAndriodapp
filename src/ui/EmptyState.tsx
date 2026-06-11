import { View } from 'react-native';
import { colors, spacing } from '@/theme';
import { Icon, IconName } from './Icon';
import { AppText } from './AppText';
import { Button } from './Button';

export function EmptyState({
  icon = 'inbox-outline',
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm }}>
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: colors.primaryTint,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.sm,
        }}>
        <Icon name={icon} size={44} color={colors.primary} />
      </View>
      <AppText variant="title">{title}</AppText>
      {subtitle && (
        <AppText
          variant="body"
          color={colors.onSurfaceVariant}
          style={{ textAlign: 'center', maxWidth: 260 }}>
          {subtitle}
        </AppText>
      )}
      {actionLabel && onAction && (
        <View style={{ marginTop: spacing.sm }}>
          <Button label={actionLabel} icon="plus" onPress={onAction} />
        </View>
      )}
    </View>
  );
}
