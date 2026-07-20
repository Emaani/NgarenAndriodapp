import { KeyboardTypeOptions, Pressable, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

const boxStyle = {
  borderWidth: 1,
  borderColor: colors.divider,
  borderRadius: radius.md,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.mdMinus,
  minHeight: 48,
  justifyContent: 'center' as const,
};

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
      {text}
      {required ? ' *' : ''}
    </AppText>
  );
}

export function TextField({
  label,
  required,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Label text={label} required={required} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.onSurfaceVariant}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[
          boxStyle,
          {
            paddingVertical: spacing.mdMinus,
            color: colors.onSurface,
            fontSize: 16,
            minHeight: multiline ? 88 : 48,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
      />
    </View>
  );
}

/** Read-only field box that opens a picker/date dialog on tap (UI placeholder). */
export function SelectField({
  label,
  required,
  value,
  placeholder = 'Select...',
  icon = 'chevron-down',
  onPress,
}: {
  label: string;
  required?: boolean;
  value?: string;
  placeholder?: string;
  icon?: IconName;
  onPress?: () => void;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Label text={label} required={required} />
      <Pressable onPress={onPress} style={[boxStyle, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <AppText variant="bodyLarge" color={value ? colors.onSurface : colors.onSurfaceVariant}>
          {value || placeholder}
        </AppText>
        <Icon name={icon} size={20} color={colors.onSurfaceVariant} />
      </Pressable>
    </View>
  );
}
