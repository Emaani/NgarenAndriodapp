import { Pressable, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { Icon } from './Icon';

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search...',
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
        borderRadius: radius.md,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.divider,
        paddingHorizontal: spacing.mdMinus,
        gap: spacing.sm,
      }}>
      <Icon name="magnify" size={20} color={colors.onSurfaceVariant} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.onSurfaceVariant}
        style={{ flex: 1, fontSize: 14, color: colors.onSurface, paddingVertical: 0 }}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <Icon name="close-circle" size={18} color={colors.onSurfaceVariant} />
        </Pressable>
      )}
    </View>
  );
}
