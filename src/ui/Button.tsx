import { ActivityIndicator, Pressable, ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '@/theme';
import { Icon, IconName } from './Icon';
import { AppText } from './AppText';

type Variant = 'primary' | 'outline' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const bg =
    variant === 'primary' ? colors.primary : variant === 'danger' ? colors.error : 'transparent';
  const fg = variant === 'outline' ? colors.onSurface : '#fff';
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          backgroundColor: bg,
          borderRadius: radius.full,
          minHeight: 48,
          paddingVertical: spacing.mdMinus,
          paddingHorizontal: spacing.lg,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: colors.divider,
          opacity: isDisabled ? 0.5 : pressed ? 0.9 : 1,
        },
        variant === 'primary' && shadow[2],
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={18} color={fg} />}
          <AppText variant="bodyLarge" color={fg} style={{ fontWeight: '600' }}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}
