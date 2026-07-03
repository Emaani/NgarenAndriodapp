import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { locations as locationsFallback, markers as markersFallback } from '@/data/mock';
import { getAnimalLocations, getLocations } from '@/data/api';
import { useResource } from '@/data/hooks';
import { AnimalMarker } from '@/data/types';
import { ActionChip, AppText, BottomSheet, Button, GradientHeader, Icon } from '@/ui';
import { MapPlaceholder } from '@/components/MapPlaceholder';

/**
 * Projects each marker's real Ceres Tag lat/lng onto the placeholder canvas as
 * a percentage position, so relative spacing reflects actual GPS positions
 * (closer animals render closer together) instead of an arbitrary index-based
 * layout. This is a stand-in for true map tiles — swap for react-native-maps'
 * own camera/marker positioning once a Google Maps API key is available.
 */
function projectMarkers(
  markers: AnimalMarker[],
): Array<AnimalMarker & { leftPct: number; topPct: number }> {
  if (markers.length === 0) return [];
  const lats = markers.map((m) => m.lat);
  const lngs = markers.map((m) => m.lng);
  const latSpan = Math.max(...lats) - Math.min(...lats) || 1;
  const lngSpan = Math.max(...lngs) - Math.min(...lngs) || 1;
  const minLat = Math.min(...lats);
  const minLng = Math.min(...lngs);
  const MARGIN = 15;
  const SPAN = 100 - MARGIN * 2;
  return markers.map((m) => {
    const xFrac = (m.lng - minLng) / lngSpan;
    // Invert latitude: further north (higher lat) renders higher on screen.
    const yFrac = 1 - (m.lat - minLat) / latSpan;
    return { ...m, leftPct: MARGIN + xFrac * SPAN, topPct: MARGIN + yFrac * SPAN };
  });
}

export default function TrackScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<AnimalMarker | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const { data: locations } = useResource(() => getLocations(), locationsFallback);
  const { data: markers, reload: reloadMarkers } = useResource(() => getAnimalLocations(), markersFallback);
  const [checked, setChecked] = useState<number[]>(locationsFallback.map((l) => l.id));
  const projectedMarkers = useMemo(() => projectMarkers(markers), [markers]);

  // Keep the location filter in sync as live locations arrive.
  useEffect(() => {
    setChecked(locations.map((l) => l.id));
  }, [locations]);

  const toggle = (id: number) =>
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader
        title="Track animals"
        compact
        right={
          <Pressable onPress={() => setFilterOpen(true)} hitSlop={8}>
            <Icon name="filter-variant" size={24} color="#fff" />
          </Pressable>
        }
      />
      <View style={{ flex: 1 }}>
        <MapPlaceholder>
          {projectedMarkers.map((m) => (
            <Pressable
              key={m.animalId}
              onPress={() => setSelected(m)}
              style={{
                position: 'absolute',
                left: `${m.leftPct}%`,
                top: `${m.topPct}%`,
                alignItems: 'center',
              }}>
              <View style={[{ backgroundColor: colors.surface, borderRadius: radius.full, padding: 6 }, shadow[2]]}>
                <Icon name="map-marker" size={24} color={m.status === 'active' ? colors.primary : colors.onSurfaceVariant} />
              </View>
            </Pressable>
          ))}
        </MapPlaceholder>

        <Pressable
          style={[
            {
              position: 'absolute',
              right: spacing.md,
              bottom: spacing.md,
              backgroundColor: colors.surface,
              borderRadius: radius.full,
              padding: spacing.mdMinus,
            },
            shadow[2],
          ]}
          onPress={() => {
            // Recenter: clear any open marker and refresh the latest positions.
            setSelected(null);
            reloadMarkers();
          }}>
          <Icon name="crosshairs-gps" size={24} color={colors.primary} />
        </Pressable>

        {selected && (
          <View
            style={[
              {
                position: 'absolute',
                left: spacing.md,
                right: spacing.md,
                bottom: spacing.md,
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                padding: spacing.md,
                gap: spacing.xs,
              },
              shadow[3],
            ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText variant="title">{selected.tag}</AppText>
              <Pressable onPress={() => setSelected(null)} hitSlop={8}>
                <Icon name="close" size={20} color={colors.onSurfaceVariant} />
              </Pressable>
            </View>
            <ActionChip label={selected.status === 'active' ? 'Active' : 'Inactive'} variant={selected.status === 'active' ? 'success' : 'neutral'} />
            <AppText variant="body" color={colors.onSurfaceVariant}>
              GPS Accuracy: {selected.accuracy}
            </AppText>
            <AppText variant="body" color={colors.onSurfaceVariant}>
              Last seen: {selected.lastSeenMins} minutes ago
            </AppText>
            <Button
              label="View Animal Detail"
              variant="outline"
              onPress={() => router.push(`/animals/${selected.animalId}`)}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        )}
      </View>

      <BottomSheet visible={filterOpen} onClose={() => setFilterOpen(false)} title="Filter by Location">
        {locations.map((l) => (
          <Pressable
            key={l.id}
            onPress={() => toggle(l.id)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.mdMinus }}>
            <Icon
              name={checked.includes(l.id) ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={22}
              color={checked.includes(l.id) ? colors.primary : colors.onSurfaceVariant}
            />
            <AppText variant="bodyLarge">{l.name}</AppText>
          </Pressable>
        ))}
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
          <Button label="Clear All" variant="outline" onPress={() => setChecked([])} style={{ flex: 1 }} />
          <Button label="Apply" onPress={() => setFilterOpen(false)} style={{ flex: 1 }} />
        </View>
      </BottomSheet>
    </View>
  );
}
