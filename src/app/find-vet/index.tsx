import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { vets } from '@/data/mock';
import { getPrimaryVetIds } from '@/data/primaryVets';
import { getEnlistedVets } from '@/data/vetEnlistments';
import { getNearbyRadiusKm, setNearbyRadiusKm, RADIUS_OPTIONS } from '@/data/vetPrefs';
import { getCalloutRequests } from '@/data/api';
import { getUnratedCompleted } from '@/data/vetRatings';
import { CalloutRequest, Vet } from '@/data/types';
import { AppText, Button, EmptyState, GradientHeader, Icon, Screen, SearchBar } from '@/ui';

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
  // Configurable "near me" radius (Sep 12 2026): default 5 km, adjustable.
  const [radiusKm, setRadiusKm] = useState(5);
  // Completed services still awaiting a rating (service-linked ratings).
  const [unrated, setUnrated] = useState<CalloutRequest[]>([]);

  // Reload trusted + admin-enlisted vets whenever the screen refocuses.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getPrimaryVetIds().then((ids) => active && setPrimaryIds(ids));
      getEnlistedVets().then((list) => active && setEnlisted(list));
      getNearbyRadiusKm().then((km) => active && setRadiusKm(km));
      getCalloutRequests()
        .then((cs) => getUnratedCompleted(cs))
        .then((list) => active && setUnrated(list))
        .catch(() => active && setUnrated([]));
      return () => {
        active = false;
      };
    }, []),
  );

  const changeRadius = (km: number) => {
    setRadiusKm(km);
    void setNearbyRadiusKm(km);
  };

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
  // Top-rated near you: nearby vets you haven't chosen yet, ranked by rating so
  // new/highly-rated vets aren't sidelined (Sep 12 2026 standup).
  const topRated = useMemo(
    () =>
      pool
        .filter((v) => !primarySet.has(v.id))
        .filter((v) => v.distanceKm <= radiusKm)
        .filter(matches)
        .sort((a, b) => (b.rating - a.rating) || (a.distanceKm - b.distanceKm)),
    [pool, primarySet, matches, radiusKm],
  );

  const hasPreferred = preferred.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Find a Vet" subtitle={hasPreferred ? 'Your preferred vets, plus top-rated nearby' : `Top-rated vets within ${radiusKm} km`} showBack />
      <View style={{ padding: spacing.md, paddingBottom: 0 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search by name, clinic or specialty..." />
      </View>
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {/* Emergency workflow (Sep 12 2026): a separate fast path that alerts
            available nearby vets right away. */}
        <Pressable
          onPress={() => router.push('/find-vet/request?emergency=1' as never)}
          style={({ pressed }) => [
            { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.errorTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.error, opacity: pressed ? 0.92 : 1 },
          ]}>
          <Icon name="alarm-light-outline" size={22} color={colors.error} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyLarge" style={{ fontWeight: '700' }} color={colors.error}>
              Emergency call-out
            </AppText>
            <AppText variant="caption" color={colors.error}>
              Alerts available vets near you right away.
            </AppText>
          </View>
          <Icon name="chevron-right" size={20} color={colors.error} />
        </Pressable>

        {/* Rate your recent visits — service-linked ratings (Sep 12 2026). */}
        {unrated.length > 0 ? (
          <View style={{ backgroundColor: colors.warningTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Icon name="star-check-outline" size={18} color="#B45309" />
              <AppText variant="body" style={{ fontWeight: '700' }} color="#B45309">
                Rate your recent {unrated.length === 1 ? 'visit' : 'visits'}
              </AppText>
            </View>
            {unrated.slice(0, 3).map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/rate-vet?callout=${c.id}&animal=${encodeURIComponent(c.animal)}&service=call-out` as never)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.sm }}>
                <Icon name="stethoscope" size={16} color={colors.primary} />
                <AppText variant="caption" color={colors.onSurface} style={{ flex: 1, fontWeight: '600' }}>
                  {c.animal} · {c.farmerName}
                </AppText>
                <AppText variant="caption" color={colors.primary} style={{ fontWeight: '700' }}>
                  Rate ›
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Configurable "near me" radius (Sep 12 2026). */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md, flexWrap: 'wrap' }}>
          <Icon name="map-marker-radius-outline" size={16} color={colors.onSurfaceVariant} />
          <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginRight: spacing.xs }}>
            Within
          </AppText>
          {RADIUS_OPTIONS.map((km) => {
            const active = radiusKm === km;
            return (
              <Pressable
                key={km}
                onPress={() => changeRadius(km)}
                style={{ paddingHorizontal: spacing.mdMinus, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: active ? colors.primary : colors.surface, borderWidth: 1, borderColor: active ? colors.primary : colors.divider }}>
                <AppText variant="caption" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                  {km} km
                </AppText>
              </Pressable>
            );
          })}
        </View>

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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, marginBottom: spacing.sm }}>
              <Icon name="star-circle-outline" size={16} color={colors.primary} />
              <AppText variant="title">Top-rated near you</AppText>
            </View>
          </>
        ) : (
          // Fallback: no preferred vet yet — guide the farmer to choose one.
          <>
            <View style={{ flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
              <Icon name="star-outline" size={20} color={colors.primary} />
              <AppText variant="caption" color={colors.primaryDark} style={{ flex: 1 }}>
                You haven’t chosen a preferred vet yet. Book a top-rated vet below and tap ★ on their profile to set them as your preferred provider — future bookings tie to their calendar.
              </AppText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
              <Icon name="star-circle-outline" size={16} color={colors.primary} />
              <AppText variant="title">Top-rated near you</AppText>
            </View>
          </>
        )}

        {topRated.length === 0 ? (
          <EmptyState
            icon="map-marker-off-outline"
            title={hasPreferred ? 'No other vets within range' : 'No vets within range'}
            subtitle={`No ${hasPreferred ? 'other ' : ''}enlisted vets are within ${radiusKm} km right now. Widen the radius above, or request a call-out and we'll match you.`}
          />
        ) : (
          topRated.map((v) => (
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
