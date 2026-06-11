import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, spacing } from '@/theme';
import { AppText } from '../AppText';

interface Slice {
  label: string;
  value: number;
  color: string;
}

/** Two-segment doughnut used on the Dashboard (allocation / connectivity). */
export function DonutChart({ slices, size = 140 }: { slices: Slice[]; size?: number }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.divider}
          strokeWidth={stroke}
          fill="none"
        />
        {slices.map((s, i) => {
          const len = (s.value / total) * c;
          const circle = (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={s.color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              rotation={-90}
              origin={`${size / 2}, ${size / 2}`}
            />
          );
          offset += len;
          return circle;
        })}
      </Svg>
      <View style={{ gap: spacing.sm }}>
        {slices.map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: s.color }} />
            <AppText variant="body" color={colors.onSurfaceVariant}>
              {s.label}
            </AppText>
            <AppText variant="body" style={{ fontWeight: '700' }}>
              {s.value}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
