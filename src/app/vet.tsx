import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing } from '@/theme';
import { CalloutRequest, CalloutStatus, CalloutUrgency, VetImpact } from '@/data/types';
import { getCalloutRequests, updateCalloutStatus } from '@/data/api';
import { getMyVetImpact } from '@/data/vetProfiles';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { roleTheme } from '@/lib/roles';
import { useT, useTStatus } from '@/i18n';
import { ActionChip, ActionGrid, AppText, Button, GridAction, Icon, IconChip, NavBanner, NotificationBell, Screen, SyncStatus, VetImpactDashboard, VetSchedule } from '@/ui';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
// start a scorecard, and the core service entry points. Shares the ActionGrid
// tile style with the farmer dashboard for a consistent look across profiles.
const QUICK_ACTIONS: GridAction[] = [
  { label: 'action.registerAnimal', icon: 'plus-circle-outline', route: '/register-animal', tint: '#6D874F' },
  { label: 'action.newScorecard', icon: 'clipboard-plus-outline', route: '/health-scorecard', tint: '#2563EB' },
  { label: 'action.stockTake', icon: 'clipboard-list-outline', route: '/stock-take', tint: '#F59E0B' },
  { label: 'action.logVisit', icon: 'clipboard-edit-outline', route: '/log-visit', tint: '#16A34A' },
];

// Clinical navigation (webapp vet nav parity): the sections a vet reaches
// beyond the day-to-day quick actions above. Keeps every vetNav destination
// discoverable from the dashboard rather than buried. Reports lives here
// (vets have no bottom tab bar); Calendar has its own section below.
const CLINICAL_NAV: GridAction[] = [
  // Livestock uses the dedicated vet herd list (/vet-animals), not the (tabs)
  // animals list — the tab group redirects vets back to this dashboard.
  { label: 'action.livestock', icon: 'cow', route: '/vet-animals', tint: '#2563EB' },
  { label: 'action.managedHealth', icon: 'heart-pulse', route: '/health', tint: '#EF4444' },
  { label: 'action.breeding', icon: 'dna', route: '/breeding', tint: '#EC4899' },
  // Calendar is not duplicated here — the dashboard already has a dedicated
  // "My Calendar" section with a full-calendar link (Oct 2026 clean-up).
  { label: 'action.reports', icon: 'file-chart-outline', route: '/vet-reports', tint: '#6D874F' },
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
  const tStatus = useTStatus();
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
          <ActionChip label={tStatus(req.status)} variant={statusVariant(req.status)} />
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
  const insets = useSafeAreaInsets();
  const theme = roleTheme('veterinary');
  const { canVet, isAuthenticated, loading, user } = useAuth();
  const displayName = user?.fullName?.trim() || user?.email?.split('@')[0] || t('vet.veterinarian');
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Role-themed header — same structure as the farmer dashboard (role
          chip, notifications, profile avatar, welcome + role stats) so the two
          consoles read as one product. Slate-blue accent per roleTheme. */}
      <LinearGradient
        colors={[theme.accent, theme.accentDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.lg,
          borderBottomLeftRadius: radius.lg,
          borderBottomRightRadius: radius.lg,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Icon name="stethoscope" size={16} color="#fff" />
            <AppText variant="caption" color="#fff" style={{ fontWeight: '700', letterSpacing: 0.5 }}>
              {t('role.veterinary').toUpperCase()} · {t('console.veterinary')}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <NotificationBell />
            <Pressable hitSlop={8} onPress={() => router.push('/settings' as never)} accessibilityLabel={t('profile.row.settings')}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.full,
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <AppText style={{ color: '#fff', fontWeight: '700' }}>{initials(displayName)}</AppText>
              </View>
            </Pressable>
          </View>
        </View>

        <View style={{ marginTop: spacing.md }}>
          <AppText variant="bodyLarge" color="rgba(255,255,255,0.9)">
            {t('vet.dashboard')}
          </AppText>
          <AppText variant="headline" color="#fff">
            {displayName}
          </AppText>
        </View>

        <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
          <HeaderStat value={counts.pending} label={t('vet.stat.pending')} />
          <HeaderStat value={counts.accepted} label={t('vet.stat.accepted')} />
          <HeaderStat value={counts.completed} label={t('vet.stat.completed')} />
        </View>
      </LinearGradient>

      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {/* Offline sync status — scorecards & photos reaching the backend. */}
        <View style={{ marginBottom: spacing.md }}>
          <SyncStatus />
        </View>

        {/* Quick actions (Oct 2026 standup): animal registration + service entry
            points on the vet side, with clear navigation. */}
        <AppText variant="title" style={{ marginBottom: spacing.md }}>
          {t('home.section.quickActions')}
        </AppText>
        <View style={{ marginBottom: spacing.lg }}>
          <ActionGrid actions={QUICK_ACTIONS} />
        </View>

        {/* Clinical navigation (webapp vet-nav parity) — Livestock, Managed
            Health, Breeding, Calendar, Reports, Devices, Messages, Marketplace
            all reachable from the hub with the same tiles as the farmer grid. */}
        <AppText variant="title" style={{ marginBottom: spacing.md }}>
          {t('home.section.clinicalTools')}
        </AppText>
        <View style={{ marginBottom: spacing.lg }}>
          <ActionGrid actions={CLINICAL_NAV} />
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
