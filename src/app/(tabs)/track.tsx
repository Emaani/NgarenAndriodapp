import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { colors, radius, shadow, spacing } from '@/theme';
import { geofences as geofencesData, locations as locationsFallback, markers as markersFallback } from '@/data/mock';
import { getAnimalLocations, getLocations } from '@/data/api';
import { AnimalFenceStatus, evaluateGeofences } from '@/data/geofencing';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { formatDistance } from '@/lib/geo';
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
  const { appRole } = useAuth();
  const [selected, setSelected] = useState<AnimalMarker | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [fenceOpen, setFenceOpen] = useState(false);
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
  const visibleGeofences = useMemo(
    () => geofencesData.filter((g) => checked.includes(g.id)),
    [checked],
  );

  // Containment is derived from the live GPS already on screen. The marker set
  // is role-scoped upstream, so admin sees the portfolio and a farmer sees only
  // their own herd without any branching here.
  const report = useMemo(
    () => evaluateGeofences(markers, visibleGeofences),
    [markers, visibleGeofences],
  );
  const breachedIds = useMemo(() => report.breaches.map((b) => b.animalId), [report.breaches]);
  const isAdmin = appRole === 'admin';

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

  // Jump from a breach row straight to the stray animal on the map.
  const locateStatus = (s: AnimalFenceStatus) => {
    setFenceOpen(false);
    const marker = markers.find((m) => m.animalId === s.animalId);
    if (marker) setSelected(marker);
    mapRef.current?.flyTo(s.lat, s.lng, 17);
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
          breachedIds={breachedIds}
          onSelectMarker={selectMarker}
        />

        {/* Breach banner — only shown when animals are actually outside. */}
        {report.breaches.length > 0 && (
          <Pressable
            onPress={() => setFenceOpen(true)}
            style={({ pressed }) => [
              {
                position: 'absolute',
                left: spacing.md,
                right: 68,
                top: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: colors.error,
                opacity: pressed ? 0.92 : 1,
              },
              shadow[2],
            ]}>
            <Icon name="alert-decagram-outline" size={20} color="#fff" />
            <View style={{ flex: 1 }}>
              <AppText variant="body" color="#fff" style={{ fontWeight: '700' }}>
                {report.breaches.length} {report.breaches.length === 1 ? 'animal' : 'animals'} outside boundary
              </AppText>
              <AppText variant="caption" color="rgba(255,255,255,0.9)">
                Furthest {formatDistance(report.breaches[0].metersOutside)} out · tap to review
              </AppText>
            </View>
            <Icon name="chevron-right" size={20} color="#fff" />
          </Pressable>
        )}

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
          <MapButton icon="vector-polygon" label="Geofences" onPress={() => setFenceOpen(true)} />
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
            {(() => {
              const s = report.statuses.find((x) => x.animalId === selected.animalId);
              const inside = s?.inside ?? true;
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Icon
                    name={inside ? 'vector-polygon' : 'alert-decagram-outline'}
                    size={15}
                    color={inside ? colors.primary : colors.error}
                  />
                  <AppText variant="caption" color={inside ? colors.onSurfaceVariant : colors.error}>
                    {report.noFences
                      ? 'No boundary drawn for this area'
                      : inside
                        ? `Inside ${s?.fenceName ?? 'boundary'}`
                        : `${formatDistance(s?.metersOutside ?? 0)} outside ${s?.fenceName ?? 'boundary'}`}
                  </AppText>
                </View>
              );
            })()}
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

      {/* Geofence status — occupancy per paddock and the breach worklist. */}
      <BottomSheet visible={fenceOpen} onClose={() => setFenceOpen(false)} title="Geofencing">
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
          {isAdmin ? 'Boundary status across the portfolio' : 'Boundary status for your herd'} ·{' '}
          {report.insideCount} inside · {report.breaches.length} outside
        </AppText>

        <View>
          {report.noFences ? (
            <AppText variant="body" color={colors.onSurfaceVariant} style={{ paddingVertical: spacing.md }}>
              No boundaries are visible. Enable a location in the filter to see its geofence.
            </AppText>
          ) : (
            <>
              {report.breaches.length > 0 && (
                <>
                  <AppText variant="overline" color={colors.error} style={{ marginBottom: spacing.sm }}>
                    Outside boundary ({report.breaches.length})
                  </AppText>
                  {report.breaches.map((b) => (
                    <Pressable
                      key={b.animalId}
                      onPress={() => locateStatus(b)}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.sm,
                        padding: spacing.md,
                        marginBottom: spacing.sm,
                        borderRadius: radius.md,
                        backgroundColor: colors.errorTint,
                        opacity: pressed ? 0.9 : 1,
                      })}>
                      <Icon name="cow-off" size={20} color={colors.error} />
                      <View style={{ flex: 1 }}>
                        <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                          {b.tag}
                        </AppText>
                        <AppText variant="caption" color={colors.onSurfaceVariant}>
                          {formatDistance(b.metersOutside)} beyond {b.fenceName ?? 'the boundary'}
                          {b.accuracy === 'Poor' ? ' · low GPS confidence' : ''}
                        </AppText>
                      </View>
                      <Icon name="crosshairs-gps" size={18} color={colors.primary} />
                    </Pressable>
                  ))}
                  <View style={{ height: spacing.md }} />
                </>
              )}

              <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
                Paddocks ({report.occupancy.length})
              </AppText>
              {report.occupancy.map(({ fence, animals }) => (
                <View
                  key={fence.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    padding: spacing.md,
                    marginBottom: spacing.sm,
                    borderRadius: radius.md,
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.divider,
                  }}>
                  <Icon name="vector-polygon" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                      {fence.name}
                    </AppText>
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      {animals.length === 0
                        ? 'No animals inside'
                        : animals.map((a) => a.tag).join(', ')}
                    </AppText>
                  </View>
                  <ActionChip
                    label={`${animals.length}`}
                    variant={animals.length > 0 ? 'success' : 'neutral'}
                  />
                </View>
              ))}
            </>
          )}
        </View>
      </BottomSheet>

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
