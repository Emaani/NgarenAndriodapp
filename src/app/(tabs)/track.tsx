import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { geofences as geofencesData, locations as locationsFallback, markers as markersFallback } from '@/data/mock';
import { getAnimalLocations, getLocations } from '@/data/api';
import { useResource } from '@/data/hooks';
import { AnimalMarker } from '@/data/types';
import { ActionChip, AppText, BottomSheet, Button, GradientHeader, Icon } from '@/ui';
import { InteractiveMap } from '@/components/InteractiveMap';

export default function TrackScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<AnimalMarker | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const { data: locations } = useResource(() => getLocations(), locationsFallback);
  const { data: markers } = useResource(() => getAnimalLocations(), markersFallback);
  const [checked, setChecked] = useState<number[]>(locationsFallback.map((l) => l.id));

  // Keep the location filter in sync as live locations arrive.
  useEffect(() => {
    setChecked(locations.map((l) => l.id));
  }, [locations]);

  const toggle = (id: number) =>
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  // Geofences follow the location filter so hiding a farm hides its boundary.
  const visibleGeofences = geofencesData.filter((g) => checked.includes(g.id));

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
        <InteractiveMap
          markers={markers}
          geofences={visibleGeofences}
          selectedId={selected?.animalId ?? null}
          onSelectMarker={setSelected}
        />

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
            <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
              <ActionChip label={selected.status === 'active' ? 'Active' : 'Inactive'} variant={selected.status === 'active' ? 'success' : 'neutral'} />
              <ActionChip label={`Satellite · ${selected.provider ?? 'Unknown'}`} variant="info" />
            </View>
            <AppText variant="body" color={colors.onSurfaceVariant}>
              GPS Accuracy: {selected.accuracy}
            </AppText>
            <AppText variant="body" color={colors.onSurfaceVariant}>
              Last seen: {selected.lastSeenMins} minutes ago
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Icon name="vector-polygon" size={15} color={colors.primary} />
              <AppText variant="caption" color={colors.onSurfaceVariant}>
                Geofence alerts on for this animal’s farm boundary
              </AppText>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <Button
                label="Detail"
                variant="outline"
                onPress={() => router.push(`/animals/${selected.animalId}`)}
                style={{ flex: 1 }}
              />
              <Button
                label={`${selected.provider ?? 'Provider'} view`}
                icon="satellite-variant"
                onPress={() => router.push(`/animals/${selected.animalId}`)}
                style={{ flex: 1 }}
              />
            </View>
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
