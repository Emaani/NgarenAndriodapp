import { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, PanResponder, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors, radius, spacing } from '@/theme';
import { AppText } from '../AppText';

const TOP_PAD = 12;
const BOTTOM_GUTTER = 18;

function coords(values: number[], w: number, plotTop: number, plotH: number, min: number, max: number) {
  const span = max - min || 1;
  const stepX = w / (values.length - 1 || 1);
  return values.map((v, i) => ({ x: i * stepX, y: plotTop + plotH - ((v - min) / span) * plotH }));
}

function linePath(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function fmt(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/**
 * Interactive two-series area+line chart: solid = Actual, dashed = PFI.
 *
 * Not static — it animates in, fills a gradient area, labels its axes, shows a
 * live pulse on the latest reading, and lets you drag across it to scrub exact
 * values via a tooltip. Backward-compatible with the previous `actual/pfi`
 * signature; `unit` and `xLabels` are optional additions.
 */
export function LineChart({
  actual,
  pfi,
  height = 160,
  unit,
  xLabels,
}: {
  actual: number[];
  pfi: number[];
  height?: number;
  unit?: string;
  xLabels?: [string, string];
}) {
  const [w, setW] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  // Entrance animation.
  const enter = useRef(new Animated.Value(0)).current;
  // Live pulse on the latest point.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [enter, pulse]);

  const all = [...actual, ...pfi];
  const rawMin = all.length ? Math.min(...all) : 0;
  const rawMax = all.length ? Math.max(...all) : 1;
  const pad = (rawMax - rawMin || 1) * 0.1;
  const min = rawMin - pad;
  const max = rawMax + pad;

  const plotH = height - TOP_PAD - BOTTOM_GUTTER;
  const plotTop = TOP_PAD;
  const baseline = plotTop + plotH;

  const aPts = w > 0 ? coords(actual, w, plotTop, plotH, min, max) : [];
  const pPts = w > 0 ? coords(pfi, w, plotTop, plotH, min, max) : [];
  const areaPath =
    aPts.length > 0
      ? `${linePath(aPts)} L${aPts[aPts.length - 1].x.toFixed(1)},${baseline} L${aPts[0].x.toFixed(1)},${baseline} Z`
      : '';

  const last = aPts[aPts.length - 1];
  const activePt = active != null ? aPts[active] : undefined;

  // Touch scrubbing — drag horizontally to select the nearest reading.
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (e) => selectAt(e.nativeEvent.locationX),
      onPanResponderMove: (e) => selectAt(e.nativeEvent.locationX),
    }),
  ).current;

  // selectAt reads latest w via ref to avoid stale closures.
  const wRef = useRef(0);
  wRef.current = w;
  function selectAt(x: number) {
    const width = wRef.current;
    if (width <= 0 || actual.length === 0) return;
    const stepX = width / (actual.length - 1 || 1);
    const idx = Math.max(0, Math.min(actual.length - 1, Math.round(x / stepX)));
    setActive(idx);
  }

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}>
      <View onLayout={onLayout} style={{ height }} {...pan.panHandlers}>
        {w > 0 && (
          <>
            <Svg width={w} height={height}>
              <Defs>
                <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.primary} stopOpacity={0.28} />
                  <Stop offset="1" stopColor={colors.primary} stopOpacity={0.02} />
                </LinearGradient>
              </Defs>

              {/* Gridlines */}
              {[0, 0.5, 1].map((t) => (
                <Line key={t} x1={0} y1={plotTop + plotH * t} x2={w} y2={plotTop + plotH * t} stroke={colors.divider} strokeWidth={1} />
              ))}

              {/* Area + lines */}
              {areaPath ? <Path d={areaPath} fill="url(#areaFill)" /> : null}
              {pPts.length ? <Path d={linePath(pPts)} stroke={colors.onSurfaceVariant} strokeWidth={1.5} strokeDasharray="4 4" fill="none" /> : null}
              {aPts.length ? <Path d={linePath(aPts)} stroke={colors.primary} strokeWidth={2.5} fill="none" /> : null}

              {/* Scrubber */}
              {activePt ? (
                <>
                  <Line x1={activePt.x} y1={plotTop} x2={activePt.x} y2={baseline} stroke={colors.primary} strokeWidth={1} strokeDasharray="3 3" />
                  <Circle cx={activePt.x} cy={activePt.y} r={5} fill={colors.primary} stroke="#fff" strokeWidth={2} />
                </>
              ) : null}

              {/* Latest point marker */}
              {last ? <Circle cx={last.x} cy={last.y} r={3.5} fill={colors.primary} /> : null}
            </Svg>

            {/* Live pulse overlay on the latest reading */}
            {last ? (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: last.x - 5,
                  top: last.y - 5,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: colors.primary,
                  opacity: pulseOpacity,
                  transform: [{ scale: pulseScale }],
                }}
              />
            ) : null}

            {/* Y-axis labels */}
            <View pointerEvents="none" style={{ position: 'absolute', left: 2, top: plotTop - 6 }}>
              <AppText variant="caption" color={colors.onSurfaceVariant}>
                {fmt(rawMax)}
              </AppText>
            </View>
            <View pointerEvents="none" style={{ position: 'absolute', left: 2, top: baseline - 8 }}>
              <AppText variant="caption" color={colors.onSurfaceVariant}>
                {fmt(rawMin)}
              </AppText>
            </View>

            {/* Tooltip */}
            {activePt != null && active != null ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: Math.max(0, Math.min(w - 84, activePt.x - 42)),
                  backgroundColor: colors.onSurface,
                  borderRadius: radius.sm,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 4,
                  minWidth: 84,
                  alignItems: 'center',
                }}>
                <AppText variant="caption" color="#fff" style={{ fontWeight: '700' }}>
                  {fmt(actual[active])}
                  {unit ? ` ${unit}` : ''}
                </AppText>
              </View>
            ) : null}
          </>
        )}
      </View>

      {/* X-axis labels (optional) */}
      {xLabels ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {xLabels[0]}
          </AppText>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {xLabels[1]}
          </AppText>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
        <Legend color={colors.primary} label="Actual" />
        {pfi.length ? <Legend color={colors.onSurfaceVariant} label="PFI" dashed /> : null}
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginLeft: 'auto' }}>
          Drag to inspect
        </AppText>
      </View>
    </Animated.View>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <View style={{ width: 16, height: 0, borderBottomWidth: 2, borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }} />
      <AppText variant="caption" color={colors.onSurfaceVariant}>
        {label}
      </AppText>
    </View>
  );
}
