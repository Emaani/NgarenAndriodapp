import { View } from 'react-native';
import { colors, spacing } from '@/theme';
import { Card } from './Card';
import { Icon, IconName } from './Icon';
import { AppText } from './AppText';

export function StatusCard({
  icon,
  value,
  label,
  onPress,
}: {
  icon: IconName;
  value: number | string;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Card onPress={onPress} style={{ flex: 1, height: 80, justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus }}>
        <Icon name={icon} size={28} color={colors.primary} />
        <View>
          <AppText variant="display" style={{ fontSize: 24, lineHeight: 28 }}>
            {value}
          </AppText>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {label}
          </AppText>
        </View>
      </View>
    </Card>
  );
}
