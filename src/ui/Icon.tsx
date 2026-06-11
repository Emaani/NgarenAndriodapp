import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '@/theme';

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

/** Material Community Icons == the web app's `mdi-*` set, for 1:1 parity. */
export function Icon({ name, size = 24, color = colors.onSurface }: IconProps) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}
