import Svg, { Circle, Ellipse, Mask, Rect } from 'react-native-svg';
import { colors } from '@/theme';

/**
 * Modern cow-head glyph — a cleaner, friendlier livestock mark than MDI's
 * bundled `cow` (this Expo/@expo/vector-icons build predates `cow-outline`).
 * Single-colour and theme-safe: solid parts are painted via an SVG mask, and
 * the eyes/nostrils are true cut-out holes, so it inherits `color` exactly like
 * a font glyph. Used everywhere the app asks for the `cow` icon (see Icon.tsx).
 */
export function CowGlyph({ size = 24, color = colors.onSurface }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Mask id="cow" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        {/* everything hidden by default; white = painted */}
        <Rect x="0" y="0" width="24" height="24" fill="#000" />
        {/* ears */}
        <Ellipse cx="4.9" cy="8.6" rx="2.4" ry="3.2" fill="#fff" transform="rotate(-28 4.9 8.6)" />
        <Ellipse cx="19.1" cy="8.6" rx="2.4" ry="3.2" fill="#fff" transform="rotate(28 19.1 8.6)" />
        {/* horns */}
        <Ellipse cx="7.6" cy="3.9" rx="1.15" ry="1.75" fill="#fff" transform="rotate(-38 7.6 3.9)" />
        <Ellipse cx="16.4" cy="3.9" rx="1.15" ry="1.75" fill="#fff" transform="rotate(38 16.4 3.9)" />
        {/* forelock tuft between the horns */}
        <Ellipse cx="12" cy="5.4" rx="2.1" ry="1.7" fill="#fff" />
        {/* face + muzzle */}
        <Ellipse cx="12" cy="11" rx="6.3" ry="6" fill="#fff" />
        <Ellipse cx="12" cy="15.7" rx="4.5" ry="3.4" fill="#fff" />
        {/* eyes (holes) */}
        <Circle cx="9.5" cy="10" r="1.05" fill="#000" />
        <Circle cx="14.5" cy="10" r="1.05" fill="#000" />
        {/* nostrils (holes) */}
        <Ellipse cx="10.5" cy="15.9" rx="0.75" ry="1.05" fill="#000" />
        <Ellipse cx="13.5" cy="15.9" rx="0.75" ry="1.05" fill="#000" />
      </Mask>
      <Rect x="0" y="0" width="24" height="24" fill={color} mask="url(#cow)" />
    </Svg>
  );
}
