import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import {
  animals as animalsFallback,
  behaviourSeries as behaviourFallback,
  calloutRequests as calloutFallback,
} from '@/data/mock';
import { getAnimalBehaviour, getAnimalById, getCalloutRequests } from '@/data/api';
import { useResource } from '@/data/hooks';
import { ageFromDate, formatDate } from '@/lib/date';
import { ActionChip, AppText, Button, ChartCard, DetailRow, EmptyState, GradientHeader, Icon, Screen } from '@/ui';

export default function AnimalDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: animal } = useResource(
    () => getAnimalById(Number(id)),
    animalsFallback.find((a) => a.id === Number(id)),
  );
  const { data: behaviour, loading: behaviourLoading } = useResource(
    () => getAnimalBehaviour(Number(id)),
    behaviourFallback,
  );
  const { data: callouts } = useResource(() => getCalloutRequests(), calloutFallback);
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={animal.name ?? animal.tag} subtitle={animal.breed.name} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <View style={{ alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
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
          <ActionChip
            label={animal.status === 'active' ? 'Active' : 'Inactive'}
            variant={animal.status === 'active' ? 'success' : 'neutral'}
          />
        </View>

        {/* Static record — the animal's own identity that doesn't change. */}
        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          Static record
        </AppText>
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>
          <DetailRow label="Tag ID" value={animal.tag} />
          <DetailRow label="Breed" value={animal.breed.name} />
          <DetailRow label="Location" value={animal.locationName ?? '—'} />
          <DetailRow label="Date of Birth" value={formatDate(animal.dateOfBirth)} />
          <DetailRow label="Age" value={ageFromDate(animal.dateOfBirth)} />
          <DetailRow label="Dam (mother)" value={animal.damTag ?? '—'} />
          <DetailRow label="Sire (father)" value={animal.sireTag ?? '—'} last={!animal.description} />
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

        <View style={{ gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.lg }}>
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
