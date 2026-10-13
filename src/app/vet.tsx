import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
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
import { formatDate } from '@/lib/date';
import { useT, useTStatus } from '@/i18n';
import { ActionChip, ActionGrid, AppText, Button, GridAction, Icon, IconChip, IconName, NavBanner, NotificationBell, Screen, SyncStatus, VetImpactDashboard, VetSchedule } from '@/ui';

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
  // Register Animal now routes through the accepted meeting so the vet can amend
  // an existing record (AAN locked, farmer approves) or register a new one.
  { label: 'action.manageRecords', icon: 'clipboard-account-outline', route: '/vet-manage-animals', tint: '#6D874F' },
  { label: 'action.newScorecard', icon: 'clipboard-plus-outline', route: '/health-scorecard', tint: '#2563EB' },
  { label: 'action.stockTake', icon: 'clipboard-list-outline', route: '/stock-take', tint: '#F59E0B' },
  { label: 'action.logVisit', icon: 'clipboard-edit-outline', route: '/log-visit', tint: '#16A34A' },
];

// Reports (Oct 2026 Q&A): the vet's intelligence centre — replaces the generic
// "Clinical Tools" nav. Each tile opens the report or the live record set behind
// it. Trend/log reports route to the Reports screen with a view param.
const REPORTS: GridAction[] = [
  { label: 'vet.report.animalsManaged', icon: 'cow', route: '/vet-animals', tint: '#2563EB' },
  { label: 'vet.report.farmersManaged', icon: 'account-multiple-outline', route: '/vet-farmers', tint: '#6D874F' },
  { label: 'vet.report.healthRecords', icon: 'heart-pulse', route: '/health', tint: '#EF4444' },
  { label: 'vet.report.breeding', icon: 'dna', route: '/breeding', tint: '#EC4899' },
  { label: 'vet.report.visitLog', icon: 'clipboard-text-outline', route: '/vet-visit-log', tint: '#0EA5E9' },
  { label: 'vet.report.diseaseTrends', icon: 'virus-outline', route: '/vet-reports?view=disease', tint: '#DC2626' },
  { label: 'vet.report.parasiteTrends', icon: 'bug-outline', route: '/vet-reports?view=parasite', tint: '#F59E0B' },
];

// Service support (Oct 2026 Q&A): reach Ngaren or the farmer. Messaging routes
// to the in-app thread; Call Ngaren dials the support line.
const NGAREN_SUPPORT_TEL = '+256200000000';

// Meeting-mode icons for the task card.
const MODE_ICON: Record<'onsite' | 'video' | 'hybrid', IconName> = {
  onsite: 'map-marker-check-outline',
  video: 'video-outline',
  hybrid: 'account-switch-outline',
};

const urgencyVariant = (u: CalloutUrgency) =>
  u === 'Emergency' ? 'error' : 'neutral';

const statusVariant = (s: CalloutStatus) =>
  s === 'accepted' ? 'success' : s === 'completed' ? 'info' : s === 'declined' ? 'error' : 'warning';

function HeaderStat({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  const inner = (
    <>
      <AppText variant="headline" color="#fff">
        {value}
      </AppText>
      <AppText variant="caption" color="rgba(255,255,255,0.9)">
        {label}
      </AppText>
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ flex: 1, alignItems: 'center', opacity: pressed ? 0.8 : 1 })}>
        {inner}
      </Pressable>
    );
  }
  return <View style={{ flex: 1, alignItems: 'center' }}>{inner}</View>;
}

function RequestCard({
  req,
  onOpen,
  onAccept,
  onDecline,
  onMap,
  onPropose,
}: {
  req: CalloutRequest;
  onOpen: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onMap: () => void;
  onPropose: () => void;
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

      {/* Task meta: service requested, meeting mode, and the booked date/time —
          the organiser view the vet needs to triage (Oct 2026 Q&A). */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' }}>
        {req.service ? <ActionChip label={req.service} variant="neutral" /> : null}
        {req.mode ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Icon name={MODE_ICON[req.mode]} size={14} color={colors.onSurfaceVariant} />
            <AppText variant="caption" color={colors.onSurfaceVariant}>{t(`fv.${req.mode}`)}</AppText>
          </View>
        ) : null}
        {req.scheduledFor ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Icon name="calendar-clock" size={14} color={colors.primary} />
            <AppText variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>
              {formatDate(req.scheduledFor)}{req.scheduledSlot ? ` · ${req.scheduledSlot}` : ''}
            </AppText>
          </View>
        ) : null}
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
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <ActionChip label={tStatus(req.status)} variant={statusVariant(req.status)} />
            <Pressable onPress={onMap} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }} hitSlop={8}>
              <Icon name="map-marker-radius" size={18} color={colors.primary} />
              <AppText variant="body" color={colors.primary} style={{ fontWeight: '600' }}>
                {t('vet.viewOnMap')}
              </AppText>
            </Pressable>
          </View>
          {/* Vet can propose an amendment to an accepted invite (Oct 2026 Q&A). */}
          {req.status === 'accepted' ? (
            <Button label={t('vet.proposeChange')} variant="outline" icon="calendar-edit" onPress={onPropose} />
          ) : null}
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
    const base =
      filter === 'all'
        ? requests
        : filter === 'pending'
          ? requests.filter((r) => r.status === 'pending')
          : requests.filter((r) => r.status === 'accepted');
    // Chronological: soonest booked date/slot first; unscheduled last.
    const key = (r: CalloutRequest) => `${r.scheduledFor ?? '9999-99-99'} ${r.scheduledSlot ?? '99:99'}`;
    return [...base].sort((a, b) => key(a).localeCompare(key(b)));
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

        {/* Task summary — tap any stat to open the calendar (Oct 2026 Q&A). */}
        <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
          <HeaderStat value={counts.pending} label={t('vet.stat.pending')} onPress={() => router.push('/calendar' as never)} />
          <HeaderStat value={counts.accepted} label={t('vet.stat.accepted')} onPress={() => router.push('/calendar' as never)} />
          <HeaderStat value={counts.completed} label={t('vet.stat.completed')} onPress={() => router.push('/calendar' as never)} />
        </View>
        <Pressable onPress={() => router.push('/calendar' as never)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm }} hitSlop={6}>
          <Icon name="calendar-month-outline" size={14} color="rgba(255,255,255,0.9)" />
          <AppText variant="caption" color="rgba(255,255,255,0.9)" style={{ fontWeight: '600' }}>
            {t('vet.viewCalendar')}
          </AppText>
        </Pressable>
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

        {/* Reports (Oct 2026 Q&A) — the intelligence centre, replacing the old
            "Clinical Tools" nav. */}
        <AppText variant="title" style={{ marginBottom: spacing.md }}>
          {t('vet.section.reports')}
        </AppText>
        <View style={{ marginBottom: spacing.lg }}>
          <ActionGrid actions={REPORTS} />
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

        {/* Service support (Oct 2026 Q&A) — contact Ngaren or the farmer. */}
        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          {t('vet.section.serviceSupport')}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
          {([
            { label: 'vet.support.messageNgaren', icon: 'message-text-outline', tint: '#0D9488', onPress: () => router.push('/compose-message?to=ngaren' as never) },
            { label: 'vet.support.callNgaren', icon: 'phone-outline', tint: '#2563EB', onPress: () => Linking.openURL(`tel:${NGAREN_SUPPORT_TEL}`).catch(() => {}) },
            { label: 'vet.support.messageFarmer', icon: 'message-reply-text-outline', tint: '#16A34A', onPress: () => router.push('/compose-message?to=farmer' as never) },
            { label: 'vet.support.callFarmer', icon: 'phone-in-talk-outline', tint: '#F59E0B', onPress: () => router.push('/compose-message?to=farmer' as never) },
          ] as { label: string; icon: IconName; tint: string; onPress: () => void }[]).map((s) => (
            <Pressable
              key={s.label}
              onPress={s.onPress}
              style={({ pressed }) => [
                { flexGrow: 1, flexBasis: '47%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.divider, opacity: pressed ? 0.9 : 1 },
                shadow[1],
              ]}>
              <View style={{ width: 36, height: 36, borderRadius: radius.full, backgroundColor: s.tint + '1A', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={s.icon} size={19} color={s.tint} />
              </View>
              <AppText variant="body" style={{ fontWeight: '600', flex: 1 }}>
                {t(s.label)}
              </AppText>
            </Pressable>
          ))}
        </View>

        {/* Status of tasks — the vet's organiser, sorted chronologically. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
          <AppText variant="title">{t('vet.section.calloutRequests')}</AppText>
          <Pressable onPress={() => router.push('/add-event' as never)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Icon name="calendar-plus" size={18} color={colors.primary} />
            <AppText variant="body" color={colors.primary} style={{ fontWeight: '600' }}>
              {t('vet.newMeeting')}
            </AppText>
          </Pressable>
        </View>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          {t('vet.tasksSorted')}
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
              onPropose={() => router.push('/messaging' as never)}
            />
          ))
        )}
      </Screen>
    </View>
  );
}
