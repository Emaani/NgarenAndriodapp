import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { colors, radius, shadow, spacing } from '@/theme';
import { geofences as geofencesData, locations as locationsFallback, markers as markersFallback } from '@/data/mock';
import { getAnimalLocations, getLocations } from '@/data/api';
import { useResource } from '@/data/hooks';
import { AnimalMarker } from '@/data/types';
import { ActionChip, AppText, BottomSheet, Button, GradientHeader, Icon, IconName } from '@/ui';
import { LiveMap, LiveMapHandle } from '@/components/LiveMap';

/** Small circular map control button. */
function MapButton({ icon, onPress, label }: { icon: IconName; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        {
          width: 42,
          height: 42,
          borderRadius: radius.full,
          backgroundColor: pressed ? colors.primaryTint : colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        },
        shadow[2],
      ]}>
      <Icon name={icon} size={22} color={colors.primary} />
    </Pressable>
  );
}

export default function TrackScreen() {
  const router = useRouter();
  const mapRef = useRef<LiveMapHandle>(null);
  const [selected, setSelected] = useState<AnimalMarker | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [locating, setLocating] = useState(false);
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

  // Centre the map on the user's real position (foreground permission only).
  const goToMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location permission needed',
          'Allow location access to centre the map on where you are.',
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      mapRef.current?.showUser(pos.coords.latitude, pos.coords.longitude);
    } catch {
      Alert.alert('Location unavailable', 'Could not get your current position. Try again outdoors.');
    } finally {
      setLocating(false);
    }
  };

  // Selecting an animal flies the map to it.
  const selectMarker = (m: AnimalMarker) => {
    setSelected(m);
    mapRef.current?.flyTo(m.lat, m.lng, 17);
  };

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
        <LiveMap
          ref={mapRef}
          markers={markers}
          geofences={visibleGeofences}
          selectedId={selected?.animalId ?? null}
          onSelectMarker={selectMarker}
        />

        {/* Map controls — zoom, fit-to-herd and my-location. */}
        <View
          style={{
            position: 'absolute',
            right: spacing.md,
            top: spacing.md,
            gap: spacing.sm,
          }}>
          <MapButton icon="plus" label="Zoom in" onPress={() => mapRef.current?.zoomIn()} />
          <MapButton icon="minus" label="Zoom out" onPress={() => mapRef.current?.zoomOut()} />
          <MapButton icon="fit-to-screen-outline" label="Fit herd" onPress={() => mapRef.current?.fitAll()} />
          <MapButton
            icon={locating ? 'crosshairs' : 'crosshairs-gps'}
            label="My location"
            onPress={goToMyLocation}
          />
        </View>

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
