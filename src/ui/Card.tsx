import { Pressable, View, ViewProps, ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '@/theme';

interface CardProps extends ViewProps {
  onPress?: () => void;
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
}

export function Card({ children, onPress, padded = true, style, ...rest }: CardProps) {
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: padded ? spacing.md : 0,
    ...shadow[1],
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [base, style as ViewStyle, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View {...rest} style={[base, style as ViewStyle]}>
      {children}
    </View>
  );
}
