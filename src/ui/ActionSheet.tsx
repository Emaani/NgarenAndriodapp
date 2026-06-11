import { Pressable, View } from 'react-native';
import { colors, spacing } from '@/theme';
import { BottomSheet } from './BottomSheet';
import { Icon, IconName } from './Icon';
import { AppText } from './AppText';

export interface SheetAction {
  label: string;
  icon: IconName;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export function ActionSheet({
  visible,
  onClose,
  title,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: SheetAction[];
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View>
        {actions.map((a, i) => (
          <Pressable
            key={i}
            disabled={a.disabled}
            onPress={() => {
              onClose();
              a.onPress();
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.mdMinus,
              opacity: a.disabled ? 0.4 : pressed ? 0.6 : 1,
            })}>
            <Icon name={a.icon} size={22} color={a.destructive ? colors.error : colors.onSurface} />
            <AppText variant="bodyLarge" color={a.destructive ? colors.error : colors.onSurface}>
              {a.label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}
