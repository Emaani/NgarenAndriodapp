import { Pressable, TextInput, View } from 'react-native';
import { colors, radius, shadow, spacing } from '@/theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

/**
 * Labeled white input with optional trailing icon (Figma auth/form fields).
 * White box, 12px radius, soft shadow, 50px tall.
 */
export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  helper,
  onIconPress,
}: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  icon?: IconName;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  helper?: React.ReactNode;
  onIconPress?: () => void;
}) {
  return (
    <View style={{ gap: spacing.sm, width: '100%' }}>
      {label && (
        <AppText variant="bodyLarge" color={colors.onSurface}>
          {label}
        </AppText>
      )}
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.mdMinus,
            height: 50,
            paddingHorizontal: 14,
            backgroundColor: colors.surface,
            borderRadius: radius.md,
          },
          shadow[1],
        ]}>
        <TextInput
          style={{ flex: 1, fontSize: 14, color: colors.onSurface }}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
        {icon &&
          (onIconPress ? (
            <Pressable onPress={onIconPress} hitSlop={8}>
              <Icon name={icon} size={16} color={colors.placeholder} />
            </Pressable>
          ) : (
            <Icon name={icon} size={16} color={colors.placeholder} />
          ))}
      </View>
      {helper}
    </View>
  );
}
