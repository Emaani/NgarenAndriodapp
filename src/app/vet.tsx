import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { CalloutRequest, CalloutStatus, CalloutUrgency, VetImpact } from '@/data/types';
import { getCalloutRequests, updateCalloutStatus } from '@/data/api';
import { getMyVetImpact } from '@/data/vetProfiles';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { useT } from '@/i18n';
import { ActionChip, AppText, Button, GradientHeader, Icon, IconChip, IconName, NavBanner, Screen, SyncStatus, VetImpactDashboard, VetSchedule } from '@/ui';

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

// Vet-side quick actions (Oct 2026 standup): register an (unregistered) animal,
// start a scorecard, and the core service entry points.
const QUICK_ACTIONS: { label: string; icon: IconName; route: string; tint: string }[] = [
  { label: 'action.registerAnimal', icon: 'plus-circle-outline', route: '/register-animal', tint: '#6D874F' },
  { label: 'action.newScorecard', icon: 'clipboard-plus-outline', route: '/health-scorecard', tint: '#2563EB' },
  { label: 'action.stockTake', icon: 'clipboard-list-outline', route: '/stock-take', tint: '#F59E0B' },
  { label: 'action.logVisit', icon: 'clipboard-edit-outline', route: '/log-visit', tint: '#16A34A' },
];

// Clinical navigation (webapp vet nav parity): the sections a vet reaches
// beyond the day-to-day quick actions above. Keeps every vetNav destination
// discoverable from the dashboard rather than buried.
const CLINICAL_NAV: { label: string; icon: IconName; route: string; tint: string }[] = [
  // Livestock uses the dedicated vet herd list (/vet-animals), not the (tabs)
  // animals list — the tab group redirects vets back to this dashboard.
  { label: 'action.livestock', icon: 'cow', route: '/vet-animals', tint: '#2563EB' },
  { label: 'action.managedHealth', icon: 'heart-pulse', route: '/health', tint: '#EF4444' },
  { label: 'action.breeding', icon: 'dna', route: '/breeding', tint: '#EC4899' },
  { label: 'action.devices', icon: 'tag-outline', route: '/devices', tint: '#9333EA' },
  { label: 'action.messages', icon: 'message-text-outline', route: '/messaging', tint: '#F59E0B' },
  { label: 'action.marketplace', icon: 'storefront-outline', route: '/marketplace', tint: '#0D9488' },
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
  const t = useT();
  // Reveal-on-accept (Sep 5 2026 anonymized vet view): before the vet accepts,
  // the requesting farmer's identity and precise location are hidden — only the
  // animal, priority, distance and reason show, enough to decide. Accepting
  // reveals the farmer name and exact location so the vet can attend.
  const revealed = req.status !== 'pending';
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
            {revealed ? `${req.farmerName} · ${req.requestedAt}` : `Requested ${req.requestedAt}`}
          </AppText>
        </View>
        <ActionChip label={req.urgency} variant={urgencyVariant(req.urgency)} />
        <Icon name="chevron-right" size={18} color={colors.onSurfaceVariant} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name={revealed ? 'map-marker' : 'map-marker-off-outline'} size={16} color={colors.onSurfaceVariant} />
        <AppText variant="body" color={colors.onSurfaceVariant}>
          {revealed ? `${req.locationName} · ${req.distanceKm} km away` : `~${req.distanceKm} km away · location shown on accept`}
        </AppText>
      </View>

      {!!req.notes && (
        <AppText variant="body" color={colors.onSurface}>
          “{req.notes}”
        </AppText>
      )}

      {req.status === 'pending' ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Icon name="shield-lock-outline" size={13} color={colors.onSurfaceVariant} />
            <AppText variant="caption" color={colors.onSurfaceVariant}>
              {t('vet.revealNote')}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button label={t('vet.decline')} variant="outline" onPress={onDecline} style={{ flex: 1 }} />
            <Button label={t('vet.accept')} icon="check" onPress={onAccept} style={{ flex: 1 }} />
          </View>
        </>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <ActionChip label={req.status[0].toUpperCase() + req.status.slice(1)} variant={statusVariant(req.status)} />
          <Pressable onPress={onMap} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }} hitSlop={8}>
            <Icon name="map-marker-radius" size={18} color={colors.primary} />
            <AppText variant="body" color={colors.primary} style={{ fontWeight: '600' }}>
              {t('vet.viewOnMap')}
            </AppText>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

export default function VetDashboard() {
  const router = useRouter();
  const t = useT();
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Pressable onPress={() => router.push('/calendar' as never)} hitSlop={8} accessibilityLabel="Calendar">
              <Icon name="calendar-month-outline" size={24} color="#fff" />
            </Pressable>
            <Pressable onPress={() => router.push('/vet-reports' as never)} hitSlop={8} accessibilityLabel="Reports">
              <Icon name="file-chart-outline" size={24} color="#fff" />
            </Pressable>
            <Pressable onPress={() => router.push('/settings' as never)} hitSlop={8} accessibilityLabel="Settings">
              <Icon name="cog-outline" size={24} color="#fff" />
            </Pressable>
            <Pressable onPress={onSignOut} hitSlop={8}>
              <Icon name="logout" size={24} color="#fff" />
            </Pressable>
          </View>
        }>
        <View style={{ marginTop: spacing.xs }}>
          <AppText variant="bodyLarge" color="rgba(255,255,255,0.9)">
            {t('vet.dashboard')}
          </AppText>
          <AppText variant="headline" color="#fff">
            {user?.fullName?.trim() || user?.email || t('vet.veterinarian')}
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
          <HeaderStat value={counts.pending} label={t('vet.stat.pending')} />
          <HeaderStat value={counts.accepted} label={t('vet.stat.accepted')} />
          <HeaderStat value={counts.completed} label={t('vet.stat.completed')} />
        </View>
      </GradientHeader>

      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {/* Offline sync status — scorecards & photos reaching the backend. */}
        <View style={{ marginBottom: spacing.md }}>
          <SyncStatus />
        </View>

        {/* Quick actions (Oct 2026 standup): animal registration + service entry
            points on the vet side, with clear navigation. */}
        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          {t('home.section.quickActions')}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
          {QUICK_ACTIONS.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => router.push(a.route as never)}
              style={({ pressed }) => [
                { flexGrow: 1, flexBasis: '47%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.divider, opacity: pressed ? 0.9 : 1 },
                shadow[1],
              ]}>
              <View style={{ width: 36, height: 36, borderRadius: radius.full, backgroundColor: a.tint + '1A', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={a.icon} size={19} color={a.tint} />
              </View>
              <AppText variant="body" style={{ fontWeight: '600', flex: 1 }}>
                {t(a.label)}
              </AppText>
            </Pressable>
          ))}
        </View>

        {/* Clinical navigation (webapp vet-nav parity) — Livestock, Managed
            Health, Breeding, Devices, Messages all reachable from the hub. */}
        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          {t('home.section.clinicalTools')}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
          {CLINICAL_NAV.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => router.push(a.route as never)}
              style={({ pressed }) => [
                { flexGrow: 1, flexBasis: '47%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.divider, opacity: pressed ? 0.9 : 1 },
                shadow[1],
              ]}>
              <View style={{ width: 36, height: 36, borderRadius: radius.full, backgroundColor: a.tint + '1A', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={a.icon} size={19} color={a.tint} />
              </View>
              <AppText variant="body" style={{ fontWeight: '600', flex: 1 }}>
                {t(a.label)}
              </AppText>
            </Pressable>
          ))}
        </View>

        {/* Veterinary impact dashboard — the vet's reach, counted from records. */}
        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          {t('vet.section.myImpact')}
        </AppText>
        <View style={{ marginBottom: spacing.lg }}>
          <VetImpactDashboard impact={impact} />
        </View>

        {/* My calendar — received bookings shown as time slots (Sep 12 2026). */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <AppText variant="title">{t('vet.section.myCalendar')}</AppText>
          <Pressable onPress={() => router.push('/calendar' as never)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <AppText variant="body" color={colors.primary} style={{ fontWeight: '600' }}>
              {t('vet.fullCalendar')}
            </AppText>
            <Icon name="chevron-right" size={18} color={colors.primary} />
          </Pressable>
        </View>
        <View style={{ marginBottom: spacing.lg }}>
          <VetSchedule bookings={requests} onOpenBooking={(bid) => router.push(`/vet-callout/${bid}` as never)} />
        </View>

        {/* Documents module (Sep 12 2026): generated scorecards & reports, stored
            and openable here. */}
        <NavBanner
          icon="folder-multiple-outline"
          title={t('home.banner.documents')}
          subtitle={t('home.banner.documentsSub')}
          onPress={() => router.push('/documents' as never)}
          style={{ marginBottom: spacing.lg }}
        />

        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          {t('vet.section.calloutRequests')}
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
                  {t(`vet.filter.${f.key}`)}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {visible.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm }}>
            <Icon name="clipboard-check-outline" size={44} color={colors.onSurfaceVariant} />
            <AppText variant="bodyLarge" color={colors.onSurfaceVariant}>
              {t('vet.noRequests')}
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
