import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { vets } from '@/data/mock';
import { Vet } from '@/data/types';
import { AppText, Button, GradientHeader, Icon, Screen, SearchBar } from '@/ui';

function VetCard({ vet, onRequest, onRate }: { vet: Vet; onRequest: () => void; onRate: () => void }) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: spacing.md,
          gap: spacing.sm,
          marginBottom: spacing.mdMinus,
        },
        shadow[1],
      ]}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: radius.full,
            backgroundColor: colors.primaryTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="stethoscope" size={26} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
              {vet.name}
            </AppText>
            <Pressable onPress={onRate} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Icon name="star" size={14} color={colors.warning} />
              <AppText variant="caption" color={colors.onSurface}>
                {vet.rating} ({vet.reviews})
              </AppText>
            </Pressable>
          </View>
          <AppText variant="body" color={colors.onSurfaceVariant}>
            {vet.clinic}
          </AppText>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {vet.specialty}
          </AppText>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="map-marker" size={14} color={colors.onSurfaceVariant} />
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {vet.distanceKm} km away
          </AppText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              marginLeft: spacing.sm,
            }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: vet.available ? colors.success : colors.onSurfaceVariant,
              }}
            />
            <AppText variant="caption" color={vet.available ? colors.success : colors.onSurfaceVariant}>
              {vet.available ? 'Available' : 'Busy'}
            </AppText>
          </View>
        </View>
        <Pressable onPress={onRequest} disabled={!vet.available}>
          <AppText variant="bodyLarge" color={vet.available ? colors.accent : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
            Request
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

export default function FindVet() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return vets.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.clinic.toLowerCase().includes(q) ||
        v.specialty.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Find a Vet" subtitle="Vets near your location" showBack />
      <View style={{ padding: spacing.md, paddingBottom: 0 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search by name, clinic or specialty..." />
      </View>
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {filtered.map((v) => (
          <VetCard
            key={v.id}
            vet={v}
            onRequest={() => router.push(`/find-vet/request?vetId=${v.id}`)}
            onRate={() => router.push(`/rate-vet?vetId=${v.id}`)}
          />
        ))}
        <Button
          label="Request a Call-out"
          icon="phone-outgoing"
          onPress={() => router.push('/find-vet/request')}
          style={{ marginTop: spacing.sm }}
        />
      </Screen>
    </View>
  );
}
