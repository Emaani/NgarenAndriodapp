import { Image, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import {
  animals as animalsFallback,
  calloutRequests as calloutFallback,
} from '@/data/mock';
import { getAnimalById, getCalloutRequests } from '@/data/api';
import { getCeresBehaviour } from '@/data/ceresBehaviour';
import { getLocalAnimalById } from '@/data/localAnimals';
import { HEALTH_TYPE_LABELS, getLocalHealthRecords } from '@/data/localHealth';
import { useResource } from '@/data/hooks';
import { ageFromDate, formatDate } from '@/lib/date';
import { taggingMeta } from '@/lib/tagging';
import { ActionChip, AppText, Button, ChartCard, DetailRow, EmptyState, GradientHeader, Icon, Screen } from '@/ui';

export default function AnimalDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  // Locally-onboarded animals (with photo IDs) take precedence over the backend.
  const { data: animal } = useResource(
    async () => (await getLocalAnimalById(Number(id))) ?? (await getAnimalById(Number(id))),
    animalsFallback.find((a) => a.id === Number(id)),
  );
  // Live Ceres telemetry for THIS animal: resolve its tag identifiers, then
  // query ceres_telemetry. Empty [] when it has no synced telemetry.
  const { data: behaviour, loading: behaviourLoading } = useResource(async () => {
    const a = (await getLocalAnimalById(Number(id))) ?? (await getAnimalById(Number(id)));
    const keys = [a?.deviceSerial ?? undefined, a?.tag, a?.ngarenCode].filter(
      (k): k is string => !!k,
    );
    return getCeresBehaviour(keys);
  }, []);
  const { data: callouts } = useResource(() => getCalloutRequests(), calloutFallback);
  // All local health records; filtered to this animal below once it resolves.
  const { data: allHealth } = useResource(() => getLocalHealthRecords(), []);
  // A Ceres Tag device reports on every series at once, so if every series is
  // empty it means this animal has no synced telemetry yet (unlinked device,
  // device not yet synced, or too new) rather than one chart failing alone.
  const hasBehaviourData = behaviour.some((s) => s.actual.length > 0 || s.pfi.length > 0);

  if (!animal) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title="Animal" showBack />
        <EmptyState icon="cow" title="Animal not found" subtitle="This animal may have been removed." />
      </View>
    );
  }

  // Services consumed — derived from what the animal record actually carries.
  const hasTag = !!animal.deviceSerial;
  const tagActive = hasTag && animal.status === 'active';
  // Vet visits booked against this animal (matched by name or tag).
  const needle = (animal.name ?? animal.tag).toLowerCase();
  const vetVisits = callouts.filter(
    (c) => c.animal.toLowerCase().includes(needle) || c.animal.toLowerCase().includes(animal.tag.toLowerCase()),
  ).length;

  // Digital health card — records keyed to this animal's Ngaren code (or tag).
  const animalKey = animal.ngarenCode ?? animal.tag;
  const animalLabel = animal.name ?? animal.tag;
  const animalHealth = allHealth.filter((r) => r.animalKey === animalKey);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={animal.name ?? animal.tag} subtitle={animal.breed.name} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <View style={{ alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
          {animal.photos && animal.photos.length > 0 ? (
            <Image
              source={{ uri: animal.photos[0] }}
              style={{ width: 120, height: 120, borderRadius: radius.lg, backgroundColor: colors.primaryTint }}
            />
          ) : (
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: radius.full,
                backgroundColor: colors.primaryTint,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="cow" size={44} color={colors.primary} />
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <ActionChip
              label={animal.status === 'active' ? 'Active' : 'Inactive'}
              variant={animal.status === 'active' ? 'success' : 'neutral'}
            />
            {animal.approvalStatus === 'pending' ? (
              <ActionChip label="Pending approval" variant="warning" />
            ) : animal.approvalStatus === 'rejected' ? (
              <ActionChip label="Rejected" variant="error" />
            ) : null}
          </View>
        </View>

        {/* Photo ID gallery (front / side / back) — the primary identifier.
            Always offer add/update so existing animals can be photographed. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <AppText variant="title">Photo ID</AppText>
          <Pressable
            onPress={() => router.push(`/edit-animal-photos?id=${animal.id}` as never)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Icon name={animal.photos && animal.photos.length > 0 ? 'image-edit-outline' : 'camera-plus-outline'} size={18} color={colors.primary} />
            <AppText variant="body" color={colors.primary} style={{ fontWeight: '600' }}>
              {animal.photos && animal.photos.length > 0 ? 'Update' : 'Add photos'}
            </AppText>
          </Pressable>
        </View>
        {animal.photos && animal.photos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}
            style={{ marginBottom: spacing.lg }}>
            {animal.photos.map((uri, i) => (
              <Image
                key={uri + i}
                source={{ uri }}
                style={{ width: 150, height: 150, borderRadius: radius.md, backgroundColor: colors.primaryTint }}
              />
            ))}
          </ScrollView>
        ) : (
          <Pressable
            onPress={() => router.push(`/edit-animal-photos?id=${animal.id}` as never)}
            style={{
              borderWidth: 1,
              borderColor: colors.divider,
              borderStyle: 'dashed',
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              paddingVertical: spacing.lg,
              alignItems: 'center',
              gap: spacing.xs,
              marginBottom: spacing.lg,
            }}>
            <Icon name="camera-plus-outline" size={28} color={colors.primary} />
            <AppText variant="body" color={colors.onSurfaceVariant}>
              No photos yet — tap to capture front, side & back
            </AppText>
          </Pressable>
        )}

        {/* Static record — the animal's own identity that doesn't change. */}
        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          Static record
        </AppText>
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>
          {/* Dual ID: the AAN (system) + the owner's farmer reference. */}
          {animal.ngarenCode ? <DetailRow label="AAN (system)" value={animal.ngarenCode} /> : null}
          <DetailRow label="Farmer reference" value={animal.tag} />
          <DetailRow label="Breed" value={animal.breed.name} />
          {animal.color ? <DetailRow label="Colour" value={animal.color} /> : null}
          <DetailRow label="Location" value={animal.locationName ?? '—'} />
          {animal.physicalAddress ? <DetailRow label="Address" value={animal.physicalAddress} /> : null}
          {/* Privacy: display age, not the date of birth. */}
          <DetailRow label="Age" value={ageFromDate(animal.dateOfBirth)} />
          <DetailRow label="Tagging method" value={taggingMeta(animal.taggingMethod).short} />
          <DetailRow label="Dam (mother)" value={animal.damTag ?? 'Unknown'} />
          <DetailRow label="Sire (father)" value={animal.sireTag ?? 'Unknown'} last={!animal.description} />
          {animal.description ? <DetailRow label="Notes" value={animal.description} last /> : null}
        </View>

        {/* Services consumed — the connected services running on this animal. */}
        <AppText variant="title" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
          Services consumed
        </AppText>
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>
          <DetailRow label="Tag associated" value={animal.deviceSerial ?? 'None'} />
          <DetailRow label="Tag status" value={hasTag ? (tagActive ? 'Active' : 'Inactive') : 'Not connected'} />
          <DetailRow label="Telemetry" value={hasBehaviourData ? 'Syncing' : hasTag ? 'Awaiting sync' : 'No device'} />
          <DetailRow label="Vet visits" value={vetVisits === 0 ? 'None booked' : String(vetVisits)} />
          <DetailRow label="Alerts monitoring" value={tagActive ? 'On' : 'Off'} last />
        </View>

        {/* Associated devices (AAN can carry more than one). */}
        {animal.devices && animal.devices.length > 0 ? (
          <>
            <AppText variant="title" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
              Devices ({animal.devices.length})
            </AppText>
            <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>
              {animal.devices.map((d, i) => (
                <DetailRow
                  key={d.serial + i}
                  label={d.type}
                  value={`${d.serial}${d.linkage ? ` · ${d.linkage === 'support' ? 'Ngaren linkage' : 'Self-linkage'}` : ''}`}
                  last={i === animal.devices!.length - 1}
                />
              ))}
            </View>
          </>
        ) : null}

        {/* Digital Health Card — chronological history for this animal's code. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm }}>
          <AppText variant="title">Health history</AppText>
          <Pressable
            onPress={() => router.push(`/add-health-record?animal=${encodeURIComponent(animalKey)}&label=${encodeURIComponent(animalLabel)}` as never)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Icon name="plus-circle-outline" size={18} color={colors.primary} />
            <AppText variant="body" color={colors.primary} style={{ fontWeight: '600' }}>
              Add
            </AppText>
          </Pressable>
        </View>
        {animalHealth.length === 0 ? (
          <AppText variant="body" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.lg }}>
            No health records yet. Tap Add to log a vaccination, treatment or ailment.
          </AppText>
        ) : (
          <View style={{ marginBottom: spacing.lg, gap: spacing.sm }}>
            {animalHealth.map((r) => (
              <View
                key={r.id}
                style={[
                  { flexDirection: 'row', gap: spacing.mdMinus, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.divider },
                  shadow[1],
                ]}>
                <View style={{ width: 8, borderRadius: 4, backgroundColor: r.type === 'ailment' ? colors.error : r.type === 'treatment' ? colors.info : colors.success }} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                      {HEALTH_TYPE_LABELS[r.type]}
                    </AppText>
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      {formatDate(r.date)}
                    </AppText>
                  </View>
                  {r.medication ? (
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      {r.medication}
                    </AppText>
                  ) : null}
                  <AppText variant="body" color={colors.onSurface}>
                    {r.notes}
                  </AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    Logged by {r.recordedBy}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
          <Button label="Track on Map" icon="map-marker-radius" onPress={() => router.push('/(tabs)/track')} />
          <Button label="Request a Vet" icon="stethoscope" variant="outline" onPress={() => router.push('/find-vet')} />
        </View>

        <AppText variant="title" style={{ marginBottom: spacing.md }}>
          Ceres Tag activity
        </AppText>
        {!behaviourLoading && !hasBehaviourData ? (
          <EmptyState
            icon="chart-line"
            title="No Ceres Tag data yet"
            subtitle="This animal's device may not be linked or hasn't synced yet."
            actionLabel="Go to Devices"
            onAction={() => router.push('/devices')}
          />
        ) : (
          behaviour.map((series) => <ChartCard key={series.label} series={series} />)
        )}
      </Screen>
    </View>
  );
}
