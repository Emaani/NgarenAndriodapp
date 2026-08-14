import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, spacing } from '@/theme';
import { AppText } from '../AppText';

interface Slice {
  label: string;
  value: number;
  color: string;
}

/**
 * Doughnut chart with a value at its centre and a percentage legend. Animates
 * in (scale + fade) so it doesn't read as a frozen graphic. Used across the
 * Insights and Telemetry analytics.
 */
export function DonutChart({
  slices,
  size = 148,
  centerLabel,
}: {
  slices: Slice[];
  size?: number;
  centerLabel?: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const denom = total || 1;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, friction: 7, tension: 60 }).start();
  }, [enter]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
      <Animated.View
        style={{
          width: size,
          height: size,
          opacity: enter,
          transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
        }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.divider} strokeWidth={stroke} fill="none" />
          {slices.map((s, i) => {
            const len = (s.value / denom) * c;
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
        {/* Centre total */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <AppText variant="headline">{total}</AppText>
          {centerLabel ? (
            <AppText variant="caption" color={colors.onSurfaceVariant}>
              {centerLabel}
            </AppText>
          ) : null}
        </View>
      </Animated.View>

      <View style={{ flex: 1, gap: spacing.sm }}>
        {slices.map((s, i) => {
          const pct = Math.round((s.value / denom) * 100);
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: s.color }} />
              <AppText variant="body" color={colors.onSurfaceVariant} style={{ flex: 1 }}>
                {s.label}
              </AppText>
              <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>
                {s.value}
              </AppText>
              <AppText variant="caption" color={colors.onSurfaceVariant} style={{ width: 38, textAlign: 'right' }}>
                {pct}%
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}
