import { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, spacing } from '@/theme';
import { AppText } from '../AppText';

function toPath(values: number[], w: number, h: number, min: number, max: number) {
  if (values.length === 0) return '';
  const span = max - min || 1;
  const stepX = w / (values.length - 1 || 1);
  return values
    .map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / span) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** Two-series line chart: solid = Actual (primary), dashed = PFI. §4.4 */
export function LineChart({
  actual,
  pfi,
  height = 130,
}: {
  actual: number[];
  pfi: number[];
  height?: number;
}) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const all = [...actual, ...pfi];
  const min = Math.min(...all);
  const max = Math.max(...all);

  return (
    <View>
      <View onLayout={onLayout} style={{ height }}>
        {w > 0 && (
          <Svg width={w} height={height}>
            <Path d={toPath(pfi, w, height, min, max)} stroke={colors.onSurfaceVariant} strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
            <Path d={toPath(actual, w, height, min, max)} stroke={colors.primary} strokeWidth={2.5} fill="none" />
            {actual.map((v, i) => {
              const span = max - min || 1;
              const stepX = w / (actual.length - 1 || 1);
              const x = i * stepX;
              const y = height - ((v - min) / span) * height;
              return <Circle key={i} cx={x} cy={y} r={2.5} fill={colors.primary} />;
            })}
          </Svg>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
        <Legend color={colors.primary} label="Actual" />
        <Legend color={colors.onSurfaceVariant} label="PFI" dashed />
      </View>
    </View>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <View
        style={{
          width: 16,
          height: 0,
          borderBottomWidth: 2,
          borderColor: color,
          borderStyle: dashed ? 'dashed' : 'solid',
        }}
      />
      <AppText variant="caption" color={colors.onSurfaceVariant}>
        {label}
      </AppText>
    </View>
  );
}
