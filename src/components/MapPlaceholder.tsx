import { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { colors } from '@/theme';

/**
 * Lightweight map stand-in for UI-first work. The backend phase swaps this for
 * react-native-maps (Track §4.8 / Map Editor §4.7) with a Google Maps API key.
 */
export function MapPlaceholder({ children }: { children?: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#DCE6D5', overflow: 'hidden' }}>
      <Svg style={{ position: 'absolute' }} width="100%" height="100%">
        {Array.from({ length: 12 }).map((_, i) => (
          <Line key={`h${i}`} x1={0} y1={i * 60} x2={1000} y2={i * 60} stroke="#C2D2B6" strokeWidth={1} />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <Line key={`v${i}`} x1={i * 60} y1={0} x2={i * 60} y2={1000} stroke="#C2D2B6" strokeWidth={1} />
        ))}
        <Path d="M-20,200 Q150,160 300,260 T700,300" stroke="#9DB98C" strokeWidth={14} fill="none" />
        <Circle cx={120} cy={420} r={70} fill="#C9DBBE" opacity={0.6} stroke={colors.primary} strokeWidth={2} />
      </Svg>
      {children}
    </View>
  );
}
