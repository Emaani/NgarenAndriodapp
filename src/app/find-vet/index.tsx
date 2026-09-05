import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { vets } from '@/data/mock';
import { getPrimaryVetIds } from '@/data/primaryVets';
import { getEnlistedVets } from '@/data/vetEnlistments';
import { Vet } from '@/data/types';
import { AppText, Button, EmptyState, GradientHeader, Icon, Screen, SearchBar } from '@/ui';

// "Uber for vets" proximity cap (Aug 29 2026 standup): only surface vets within
// a short radius, since farmers and vets travel locally (bicycle, boda).
const PROXIMITY_KM = 5;

function initials(name: string): string {
  const parts = name.replace(/^Dr\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function Tag({ icon, label }: { icon: 'video' | 'cash-multiple'; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.background, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2, borderWidth: 1, borderColor: colors.divider }}>
      <Icon name={icon} size={12} color={colors.onSurfaceVariant} />
      <AppText variant="caption" color={colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
        {label}
      </AppText>
    </View>
  );
}

function VetCard({ vet, isPrimary, ctaLabel = 'Request', onOpen, onRequest }: { vet: Vet; isPrimary?: boolean; ctaLabel?: string; onOpen: () => void; onRequest: () => void }) {
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.mdMinus, opacity: pressed ? 0.95 : 1, borderWidth: isPrimary ? 1 : 0, borderColor: '#FBBF24' },
        shadow[1],
      ]}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View>
          <View style={{ width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
            <AppText variant="bodyLarge" color={colors.primaryDark} style={{ fontWeight: '800' }}>
              {initials(vet.name)}
            </AppText>
          </View>
          {vet.videoVisits ? (
            <View style={{ position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.onSurface, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface }}>
              <Icon name="video" size={11} color="#fff" />
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {isPrimary ? <Icon name="star" size={14} color="#FBBF24" /> : null}
            <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>
              {vet.name}
            </AppText>
          </View>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {vet.credentials ?? vet.specialty}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="star" size={14} color={colors.warning} />
            <AppText variant="caption" color={colors.onSurface} style={{ fontWeight: '600' }}>
              {vet.rating.toFixed(2)}
            </AppText>
            <AppText variant="caption" color={colors.onSurfaceVariant}>
              · {vet.reviews} reviews
            </AppText>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Icon name="map-marker" size={13} color={colors.onSurfaceVariant} />
            <AppText variant="caption" color={colors.onSurfaceVariant}>
              {vet.distanceKm} km
            </AppText>
          </View>
          <AppText variant="caption" color={vet.available ? colors.success : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
            {vet.available ? 'Available' : 'Busy'}
          </AppText>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        {vet.videoVisits ? <Tag icon="video" label="Video visits" /> : null}
        {vet.selfPay ? <Tag icon="cash-multiple" label="Self-pay" /> : null}
        <View style={{ flex: 1 }} />
        <Pressable onPress={onRequest} disabled={!vet.available} hitSlop={8} style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: vet.available ? colors.primary : colors.divider }}>
          <AppText variant="body" color={vet.available ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '700' }}>
            {ctaLabel}
          </AppText>
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function FindVet() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [primaryIds, setPrimaryIds] = useState<number[]>([]);
  const [enlisted, setEnlisted] = useState<Vet[]>([]);

  // Reload trusted + admin-enlisted vets whenever the screen refocuses.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getPrimaryVetIds().then((ids) => active && setPrimaryIds(ids));
      getEnlistedVets().then((list) => active && setEnlisted(list));
      return () => {
        active = false;
      };
    }, []),
  );

  // Admin-enlisted vets join the seeded pool.
  const pool = useMemo(() => [...enlisted, ...vets], [enlisted]);

  // Preferred vets are matched by the farmer's saved trusted list — booking is
  // tied to their calendar availability (Sep 5 2026 standup). When the farmer
  // has none, we fall back to "discover vets near me" (the proximity list).
  const primarySet = useMemo(() => new Set(primaryIds), [primaryIds]);
  const matches = useCallback(
    (v: Vet) => {
      const q = query.toLowerCase();
      return (
        v.name.toLowerCase().includes(q) ||
        v.clinic.toLowerCase().includes(q) ||
        v.specialty.toLowerCase().includes(q)
      );
    },
    [query],
  );

  // Preferred vets: shown regardless of proximity (they're your chosen providers).
  const preferred = useMemo(
    () => pool.filter((v) => primarySet.has(v.id)).filter(matches).sort((a, b) => a.distanceKm - b.distanceKm),
    [pool, primarySet, matches],
  );
  // Discover: nearby vets you haven't chosen yet.
  const discover = useMemo(
    () =>
      pool
        .filter((v) => !primarySet.has(v.id))
        .filter((v) => v.distanceKm <= PROXIMITY_KM)
        .filter(matches)
        .sort((a, b) => a.distanceKm - b.distanceKm),
    [pool, primarySet, matches],
  );

  const hasPreferred = preferred.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Find a Vet" subtitle={hasPreferred ? 'Book your preferred vet, or discover others nearby' : `Vets within ${PROXIMITY_KM} km of your location`} showBack />
      <View style={{ padding: spacing.md, paddingBottom: 0 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search by name, clinic or specialty..." />
      </View>
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {/* Preferred vets first — booking opens their availability calendar. */}
        {hasPreferred ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
              <Icon name="star" size={16} color="#FBBF24" />
              <AppText variant="title">Your preferred vets</AppText>
            </View>
            {preferred.map((v) => (
              <VetCard
                key={v.id}
                vet={v}
                isPrimary
                ctaLabel="Book"
                onOpen={() => router.push(`/find-vet/${v.id}` as never)}
                onRequest={() => router.push(`/find-vet/${v.id}` as never)}
              />
            ))}
            <AppText variant="title" style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
              Discover vets near me
            </AppText>
          </>
        ) : (
          // Fallback: no preferred vet yet — guide the farmer to choose one.
          <View style={{ flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
            <Icon name="star-outline" size={20} color={colors.primary} />
            <AppText variant="caption" color={colors.primaryDark} style={{ flex: 1 }}>
              You haven’t chosen a preferred vet yet. Discover vets near you and tap ★ on a profile to set them as your preferred provider — future bookings tie to their calendar.
            </AppText>
          </View>
        )}

        {discover.length === 0 ? (
          <EmptyState
            icon="map-marker-off-outline"
            title={hasPreferred ? 'No other vets within range' : 'No vets within range'}
            subtitle={`No ${hasPreferred ? 'other ' : ''}enlisted vets are within ${PROXIMITY_KM} km right now. Try again later or request a call-out and we'll match you.`}
          />
        ) : (
          discover.map((v) => (
            <VetCard
              key={v.id}
              vet={v}
              onOpen={() => router.push(`/find-vet/${v.id}` as never)}
              onRequest={() => router.push(`/find-vet/request?vetId=${v.id}`)}
            />
          ))
        )}
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
