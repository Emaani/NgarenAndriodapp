import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { calloutRequests as seed } from '@/data/mock';
import { CalloutRequest, CalloutStatus, CalloutUrgency } from '@/data/types';
import { ActionChip, AppText, Button, GradientHeader, Icon, IconChip, Screen } from '@/ui';

type Filter = 'pending' | 'accepted' | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'all', label: 'All' },
];

const urgencyVariant = (u: CalloutUrgency) =>
  u === 'Emergency' ? 'error' : u === 'Soon' ? 'warning' : 'neutral';

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
  onAccept,
  onDecline,
  onMap,
}: {
  req: CalloutRequest;
  onAccept: () => void;
  onDecline: () => void;
  onMap: () => void;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.mdMinus,
          borderWidth: 1,
          borderColor: colors.divider,
          gap: spacing.mdMinus,
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
    </View>
  );
}

export default function VetDashboard() {
  const router = useRouter();
  const [requests, setRequests] = useState<CalloutRequest[]>(seed);
  const [filter, setFilter] = useState<Filter>('pending');

  const setStatus = (id: number, status: CalloutStatus) =>
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader
        showBack
        right={
          <Pressable onPress={() => router.replace('/(tabs)/home')} hitSlop={8}>
            <Icon name="account-switch-outline" size={24} color="#fff" />
          </Pressable>
        }>
        <View style={{ marginTop: spacing.xs }}>
          <AppText variant="bodyLarge" color="rgba(255,255,255,0.9)">
            Vet dashboard
          </AppText>
          <AppText variant="headline" color="#fff">
            Dr. Sarah Mwangi
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
          <HeaderStat value={counts.pending} label="Pending" />
          <HeaderStat value={counts.accepted} label="Accepted" />
          <HeaderStat value={counts.completed} label="Completed" />
        </View>
      </GradientHeader>

      <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, paddingBottom: 0 }}>
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

      <Screen contentStyle={{ paddingTop: spacing.md }}>
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
