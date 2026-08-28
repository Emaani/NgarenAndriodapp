import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '@/theme';
import { CowGlyph } from './CowGlyph';

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

/** Material Community Icons == the web app's `mdi-*` set, for 1:1 parity. */
export function Icon({ name, size = 24, color = colors.onSurface }: IconProps) {
  // The bundled MDI ships only a dated `cow`; use our modern in-house glyph
  // wherever the app asks for it, so livestock reads cleanly everywhere.
  if (name === 'cow') return <CowGlyph size={size} color={color} />;
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}
