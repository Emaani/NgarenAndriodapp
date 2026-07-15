import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { colors, radius, shadow, spacing } from '@/theme';
import { AnimalMarker } from '@/data/types';
import { Geofence } from '@/data/mock';
import { Icon } from '@/ui';

interface LatLng {
  lat: number;
  lng: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * A functional, dependency-free live-tracking map: pinch to zoom, drag to pan,
 * +/- controls, geofence boundaries drawn as polygons, and livestock markers
 * placed by real GPS. It projects every lat/lng (markers + geofence rings) onto
 * a shared canvas so positions and boundaries line up. This stands in for a
 * native Google/Mapbox map (which needs an API key + native module); the marker
 * / geofence / preferences semantics are ready to port to one later.
 */
export function InteractiveMap({
  markers,
  geofences,
  selectedId,
  onSelectMarker,
}: {
  markers: AnimalMarker[];
  geofences: Geofence[];
  selectedId?: number | null;
  onSelectMarker: (m: AnimalMarker) => void;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTy = useSharedValue(0);

  // Project all coordinates onto the current canvas with a margin so markers and
  // geofences share one coordinate space.
  const projection = useMemo(() => {
    const pts: LatLng[] = [
      ...markers.map((m) => ({ lat: m.lat, lng: m.lng })),
      ...geofences.flatMap((g) => g.ring),
    ];
    if (pts.length === 0 || size.w === 0) {
      return { project: (_p: LatLng) => ({ x: 0, y: 0 }) };
    }
    const lats = pts.map((p) => p.lat);
    const lngs = pts.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latSpan = maxLat - minLat || 1;
    const lngSpan = maxLng - minLng || 1;
    const margin = 0.14;
    const usableW = size.w * (1 - margin * 2);
    const usableH = size.h * (1 - margin * 2);
    return {
      project: (p: LatLng) => ({
        x: size.w * margin + ((p.lng - minLng) / lngSpan) * usableW,
        // invert latitude so north renders up
        y: size.h * margin + (1 - (p.lat - minLat) / latSpan) * usableH,
      }),
    };
  }, [markers, geofences, size]);

  const pan = Gesture.Pan().onUpdate((e) => {
    tx.value = savedTx.value + e.translationX;
    ty.value = savedTy.value + e.translationY;
  }).onEnd(() => {
    savedTx.value = tx.value;
    savedTy.value = ty.value;
  });

  const pinch = Gesture.Pinch().onUpdate((e) => {
    // Inlined clamp — gesture callbacks are worklets and can't call JS helpers.
    scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * e.scale));
  }).onEnd(() => {
    savedScale.value = scale.value;
  });

  const composed = Gesture.Simultaneous(pan, pinch);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const zoomBy = (factor: number) => {
    const next = clamp(savedScale.value * factor, MIN_SCALE, MAX_SCALE);
    scale.value = withTiming(next, { duration: 180 });
    savedScale.value = next;
  };

  const reset = () => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  return (
    <View style={{ flex: 1, overflow: 'hidden', backgroundColor: '#DCE6D5' }} onLayout={onLayout}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
          {size.w > 0 && (
            <Svg style={{ position: 'absolute' }} width="100%" height="100%">
              {/* terrain grid */}
              {Array.from({ length: 14 }).map((_, i) => (
                <Line key={`h${i}`} x1={0} y1={i * (size.h / 12)} x2={size.w} y2={i * (size.h / 12)} stroke="#C2D2B6" strokeWidth={1} />
              ))}
              {Array.from({ length: 14 }).map((_, i) => (
                <Line key={`v${i}`} x1={i * (size.w / 12)} y1={0} x2={i * (size.w / 12)} y2={size.h} stroke="#C2D2B6" strokeWidth={1} />
              ))}
              {/* geofences */}
              {geofences.map((g) => {
                const points = g.ring.map((p) => {
                  const { x, y } = projection.project(p);
                  return `${x},${y}`;
                }).join(' ');
                const label = projection.project(g.ring[0]);
                return (
                  <G key={g.id}>
                    <Polygon points={points} fill={colors.primary + '22'} stroke={colors.primary} strokeWidth={2} strokeDasharray="6 4" />
                    <SvgText x={label.x + 4} y={label.y - 6} fill={colors.primary} fontSize={11} fontWeight="bold">
                      {g.name}
                    </SvgText>
                  </G>
                );
              })}
              {/* accuracy halo for the selected marker */}
              {markers.map((m) => {
                if (m.animalId !== selectedId) return null;
                const { x, y } = projection.project(m);
                return <Circle key={`halo${m.animalId}`} cx={x} cy={y} r={26} fill={colors.primary + '22'} stroke={colors.primary} strokeWidth={1.5} />;
              })}
            </Svg>
          )}

          {size.w > 0 &&
            markers.map((m) => {
              const { x, y } = projection.project(m);
              const active = m.status === 'active';
              return (
                <Pressable
                  key={m.animalId}
                  onPress={() => onSelectMarker(m)}
                  style={{ position: 'absolute', left: x - 18, top: y - 34, alignItems: 'center' }}>
                  <View style={[{ backgroundColor: colors.surface, borderRadius: radius.full, padding: 5 }, shadow[2]]}>
                    <Icon name="map-marker" size={22} color={active ? colors.primary : colors.onSurfaceVariant} />
                  </View>
                </Pressable>
              );
            })}
        </Animated.View>
      </GestureDetector>

      {/* zoom controls */}
      <View style={{ position: 'absolute', right: spacing.md, top: spacing.md, gap: spacing.sm }}>
        <MapButton icon="plus" onPress={() => zoomBy(1.5)} />
        <MapButton icon="minus" onPress={() => zoomBy(1 / 1.5)} />
        <MapButton icon="crosshairs-gps" onPress={reset} />
      </View>
    </View>
  );
}

function MapButton({ icon, onPress }: { icon: 'plus' | 'minus' | 'crosshairs-gps'; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          width: 44,
          height: 44,
          borderRadius: radius.full,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        },
        shadow[2],
      ]}>
      <Icon name={icon} size={22} color={colors.primary} />
    </Pressable>
  );
}
