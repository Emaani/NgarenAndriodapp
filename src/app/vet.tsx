import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { CalloutRequest, CalloutStatus, CalloutUrgency, VetImpact } from '@/data/types';
import { getCalloutRequests, updateCalloutStatus } from '@/data/api';
import { getMyVetImpact } from '@/data/vetProfiles';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { ActionChip, AppText, Button, GradientHeader, Icon, IconChip, Screen, VetImpactDashboard } from '@/ui';

const EMPTY_IMPACT: VetImpact = {
  totalVisits: 0,
  animalsManaged: 0,
  farmersServiced: 0,
  services: { treatment: 0, vaccination: 0, stockTaking: 0, others: 0 },
  observations: { ticks: 0, flies: 0, disease: 0 },
};

type Filter = 'pending' | 'accepted' | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'all', label: 'All' },
];

const urgencyVariant = (u: CalloutUrgency) =>
  u === 'Emergency' ? 'error' : 'neutral';

const statusVariant = (s: CalloutStatus) =>
  s === 'accepted' ? 'success' : s === 'completed' ? 'info' : s === 'declined' ? 'error' : 'warning';

function HeaderStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <AppText variant="headline" color="#fff">
        {value}
      </AppText>
      <AppText variant="caption" color="rgba(255,255,255,0.9)">
        {label}
      </AppText>
    </View>
  );
}

function RequestCard({
  req,
  onOpen,
  onAccept,
  onDecline,
  onMap,
}: {
  req: CalloutRequest;
  onOpen: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onMap: () => void;
}) {
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.mdMinus,
          borderWidth: 1,
          borderColor: colors.divider,
          gap: spacing.mdMinus,
          opacity: pressed ? 0.95 : 1,
        },
        shadow[1],
      ]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus }}>
        <IconChip icon="cow" />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
            {req.animal}
          </AppText>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {req.farmerName} · {req.requestedAt}
          </AppText>
        </View>
        <ActionChip label={req.urgency} variant={urgencyVariant(req.urgency)} />
        <Icon name="chevron-right" size={18} color={colors.onSurfaceVariant} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="map-marker" size={16} color={colors.onSurfaceVariant} />
        <AppText variant="body" color={colors.onSurfaceVariant}>
          {req.locationName} · {req.distanceKm} km away
        </AppText>
      </View>

      {!!req.notes && (
        <AppText variant="body" color={colors.onSurface}>
          “{req.notes}”
        </AppText>
      )}

      {req.status === 'pending' ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button label="Decline" variant="outline" onPress={onDecline} style={{ flex: 1 }} />
          <Button label="Accept" icon="check" onPress={onAccept} style={{ flex: 1 }} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <ActionChip label={req.status[0].toUpperCase() + req.status.slice(1)} variant={statusVariant(req.status)} />
          <Pressable onPress={onMap} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }} hitSlop={8}>
            <Icon name="map-marker-radius" size={18} color={colors.primary} />
            <AppText variant="body" color={colors.primary} style={{ fontWeight: '600' }}>
              View on map
            </AppText>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

export default function VetDashboard() {
  const router = useRouter();
  const { canVet, isAuthenticated, loading, user, signOut } = useAuth();
  const [requests, setRequests] = useState<CalloutRequest[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const { data: impact } = useResource(getMyVetImpact, EMPTY_IMPACT);

  useEffect(() => {
    getCalloutRequests()
      .then(setRequests)
      .catch(() => setRequests([]));
  }, []);

  const counts = useMemo(
    () => ({
      pending: requests.filter((r) => r.status === 'pending').length,
      accepted: requests.filter((r) => r.status === 'accepted').length,
      completed: requests.filter((r) => r.status === 'completed').length,
    }),
    [requests],
  );

  const visible = useMemo(() => {
    if (filter === 'all') return requests;
    if (filter === 'pending') return requests.filter((r) => r.status === 'pending');
    return requests.filter((r) => r.status === 'accepted');
  }, [requests, filter]);

  // Vet call-out queue: open to vets (their home) and admins (who reach it from
  // the dashboard). Plain farmers go back to their home.
  // (Declared after all hooks to keep hook order stable across renders.)
  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!canVet) return <Redirect href="/(tabs)/home" />;

  const setStatus = (id: number, status: CalloutStatus) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    updateCalloutStatus(id, status).catch(() => {});
  };

  const onSignOut = () => {
    signOut();
    router.replace('/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader
        showBack
        right={
          <Pressable onPress={onSignOut} hitSlop={8}>
            <Icon name="logout" size={24} color="#fff" />
          </Pressable>
        }>
        <View style={{ marginTop: spacing.xs }}>
          <AppText variant="bodyLarge" color="rgba(255,255,255,0.9)">
            Vet dashboard
          </AppText>
          <AppText variant="headline" color="#fff">
            {user?.fullName?.trim() || user?.email || 'Veterinarian'}
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
          <HeaderStat value={counts.pending} label="Pending" />
          <HeaderStat value={counts.accepted} label="Accepted" />
          <HeaderStat value={counts.completed} label="Completed" />
        </View>
      </GradientHeader>

      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {/* Veterinary impact dashboard — the vet's reach, counted from records. */}
        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          My impact
        </AppText>
        <View style={{ marginBottom: spacing.lg }}>
          <VetImpactDashboard impact={impact} />
        </View>

        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          Call-out requests
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.full,
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.divider,
                }}>
                <AppText variant="body" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                  {f.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {visible.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm }}>
            <Icon name="clipboard-check-outline" size={44} color={colors.onSurfaceVariant} />
            <AppText variant="bodyLarge" color={colors.onSurfaceVariant}>
              No requests here
            </AppText>
          </View>
        ) : (
          visible.map((r) => (
            <RequestCard
              key={r.id}
              req={r}
              onOpen={() => router.push(`/vet-callout/${r.id}` as never)}
              onAccept={() => setStatus(r.id, 'accepted')}
              onDecline={() => setStatus(r.id, 'declined')}
              onMap={() => router.push('/(tabs)/track')}
            />
          ))
        )}
      </Screen>
    </View>
  );
}
