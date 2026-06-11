import { Text, TextProps } from 'react-native';
import { colors, type as typeTokens, TypeToken } from '@/theme';

interface AppTextProps extends TextProps {
  variant?: TypeToken;
  color?: string;
}

export function AppText({
  variant = 'body',
  color = colors.onSurface,
  style,
  ...rest
}: AppTextProps) {
  return <Text {...rest} style={[typeTokens[variant], { color }, style]} />;
}
