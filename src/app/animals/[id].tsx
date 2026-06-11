import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { animals } from '@/data/mock';
import { ActionChip, AppText, Button, DetailRow, EmptyState, GradientHeader, Icon, Screen } from '@/ui';

export default function AnimalDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const animal = animals.find((a) => a.id === Number(id));

  if (!animal) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title="Animal" showBack />
        <EmptyState icon="cow" title="Animal not found" subtitle="This animal may have been removed." />
      </View>
    );
  }

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

        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>
          <DetailRow label="Tag ID" value={animal.tag} />
          <DetailRow label="Breed" value={animal.breed.name} />
          <DetailRow label="Location" value={animal.locationName ?? '—'} />
          <DetailRow label="Date of Birth" value={animal.dateOfBirth} />
          <DetailRow label="Device" value={animal.deviceSerial ?? 'Not connected'} />
          {animal.description ? <DetailRow label="Notes" value={animal.description} last /> : null}
        </View>

        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <Button label="Track on Map" icon="map-marker-radius" onPress={() => router.push('/(tabs)/track')} />
          <Button label="Request a Vet" icon="stethoscope" variant="outline" onPress={() => router.push('/find-vet')} />
        </View>
      </Screen>
    </View>
  );
}
