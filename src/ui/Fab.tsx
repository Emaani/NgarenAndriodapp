import { Pressable } from 'react-native';
import { colors, layout, radius, shadow, spacing } from '@/theme';
import { Icon, IconName } from './Icon';

export function Fab({ icon = 'plus', onPress }: { icon?: IconName; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          position: 'absolute',
          right: spacing.md,
          bottom: layout.bottomNavHeight + spacing.md,
          width: layout.fabSize,
          height: layout.fabSize,
          borderRadius: radius.xl,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.9 : 1,
        },
        shadow[2],
      ]}>
      <Icon name={icon} size={28} color="#fff" />
    </Pressable>
  );
}
