import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing } from '@/theme';
import { summary as summaryFallback, isTagActive, devices as devicesFallback, locations as locationsFallback } from '@/data/mock';
import { getSummary, getCalloutRequests, getDevices, getLocations } from '@/data/api';
import { getLocalAnimals } from '@/data/localAnimals';
import { getLastStockTake } from '@/data/localStockTake';
import { getHerd } from '@/data/herd';
import { formatDate } from '@/lib/date';
import { getFarmerPortfolio, portfolioTotals } from '@/data/portfolio';
import { getEnlistedVets } from '@/data/vetEnlistments';
import { vets as seededVets } from '@/data/mock';
import { VET_METRICS_FALLBACK, getVetMetrics } from '@/data/vet';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { roleTheme } from '@/lib/roles';
import { Permission } from '@/lib/permissions';
import { TAGGING_META, TaggingMethod, taggingMeta } from '@/lib/tagging';
import { useT } from '@/i18n';
import { ActionGrid, AppText, Icon, IconName, NavBanner, NotificationBell } from '@/ui';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// `label` holds an i18n key (translated at render via t()), so the grids switch
// language with the rest of the app.
type Action = { icon: IconName; label: string; route: string; tint: string; perm?: Permission };

// Farmer Quick Actions (Oct 2026 Q&A) — refocused to the key activities. The
// busy grid was cut: secondary destinations moved to Reports (below) or the
// account profile (Payments, Messages, Marketplace, Team). `perm` still gates
// actions for delegated seat members.
const FARMER_ACTIONS: Action[] = [
  { icon: 'clipboard-check-outline', label: 'action.manageRecords', route: '/approvals', tint: '#F59E0B' },
  { icon: 'calendar-month-outline', label: 'action.manageCalendar', route: '/calendar', tint: '#0EA5E9' },
  { icon: 'plus-circle-outline', label: 'action.registerAnimal', route: '/register-animal', tint: '#6D874F', perm: 'register_animal' },
  { icon: 'stethoscope', label: 'action.findVetNear', route: '/find-vet', tint: '#21C45D', perm: 'book_vet' },
];

// Farmer Reports (Oct 2026 Q&A) — the detailed record sets.
const FARMER_REPORTS: Action[] = [
  { icon: 'cow', label: 'report.myAnimals', route: '/(tabs)/animals', tint: '#2563EB', perm: 'view_animals' },
  { icon: 'clipboard-list-outline', label: 'report.stockTaking', route: '/stock-take', tint: '#F59E0B', perm: 'stock_take' },
  { icon: 'heart-pulse', label: 'report.healthRecords', route: '/health', tint: '#EF4444', perm: 'view_health' },
  { icon: 'tag-outline', label: 'report.deviceManager', route: '/devices', tint: '#9333EA', perm: 'view_animals' },
  { icon: 'dna', label: 'report.breeding', route: '/breeding', tint: '#EC4899', perm: 'view_animals' },
];

// Admin "Enterprise Control Center" — organisation-wide oversight tools that a
// farmer does not get (mirrors the Command Center's adminNav superset).
const ADMIN_ACTIONS: Action[] = [
  { icon: 'account-multiple-outline', label: 'action.farmersPortfolio', route: '/farmers', tint: '#6D874F' },
  { icon: 'check-decagram-outline', label: 'action.activation', route: '/approvals', tint: '#F59E0B' },
  { icon: 'cow', label: 'action.livestock', route: '/(tabs)/animals', tint: '#2563EB' },
  { icon: 'map-marker-radius', label: 'action.track', route: '/(tabs)/track', tint: '#16A34A' },
  { icon: 'chart-box-outline', label: 'action.insights', route: '/insights', tint: '#0D9488' },
  { icon: 'chart-timeline-variant', label: 'action.telemetry', route: '/telemetry', tint: '#0EA5E9' },
  { icon: 'file-chart-outline', label: 'action.reports', route: '/reports', tint: '#6D874F' },
  { icon: 'storefront-outline', label: 'action.marketplace', route: '/marketplace', tint: '#0D9488' },
  { icon: 'webhook', label: 'action.webhookMonitor', route: '/webhook-monitor', tint: '#7C3AED' },
  { icon: 'shield-check-outline', label: 'action.linkageHealth', route: '/linkage-health', tint: '#0891B2' },
  { icon: 'cloud-alert', label: 'action.alertHistory', route: '/alerts', tint: '#EF4444' },
  { icon: 'heart-pulse', label: 'action.managedHealth', route: '/health', tint: '#DC2626' },
  { icon: 'dna', label: 'action.breeding', route: '/breeding', tint: '#EC4899' },
  { icon: 'radar', label: 'action.diseaseSurveillance', route: '/surveillance', tint: '#0D9488' },
  { icon: 'alert-octagon-outline', label: 'profile.row.incidentsSla', route: '/incidents', tint: '#DC2626' },
  { icon: 'history', label: 'action.auditLog', route: '/audit-log', tint: '#64748B' },
  { icon: 'calendar-month-outline', label: 'action.calendar', route: '/calendar', tint: '#0EA5E9' },
  { icon: 'message-text-outline', label: 'action.messages', route: '/messaging', tint: '#F59E0B' },
  { icon: 'account-group-outline', label: 'action.teamUsers', route: '/users', tint: '#0284C7' },
  { icon: 'clipboard-pulse-outline', label: 'action.vetCallouts', route: '/vet', tint: '#F59E0B' },
  { icon: 'shield-account-outline', label: 'action.serviceVetting', route: '/service-vetting', tint: '#0891B2' },
  { icon: 'account-plus-outline', label: 'action.enlistVet', route: '/enlist-vet', tint: '#21C45D' },
  { icon: 'tag-outline', label: 'action.devices', route: '/devices', tint: '#9333EA' },
  { icon: 'map-marker-outline', label: 'action.locations', route: '/locations', tint: '#0D9488' },
];

// Vet "Health Intelligence System" — clinical oversight across assigned farms.
const VET_ACTIONS: Action[] = [
  { icon: 'clipboard-pulse-outline', label: 'action.calloutQueue', route: '/vet', tint: '#3D99F5' },
  { icon: 'clipboard-edit-outline', label: 'action.logVisit', route: '/log-visit', tint: '#16A34A' },
  { icon: 'heart-pulse', label: 'action.managedHealth', route: '/health', tint: '#EF4444' },
  { icon: 'cow', label: 'action.livestock', route: '/vet-animals', tint: '#2563EB' },
  { icon: 'calendar-month-outline', label: 'action.calendar', route: '/calendar', tint: '#0EA5E9' },
  { icon: 'file-chart-outline', label: 'action.reports', route: '/vet-reports', tint: '#6D874F' },
  { icon: 'tag-outline', label: 'action.devices', route: '/devices', tint: '#9333EA' },
  { icon: 'storefront-outline', label: 'action.marketplace', route: '/marketplace', tint: '#0D9488' },
  { icon: 'message-text-outline', label: 'action.messages', route: '/messaging', tint: '#F59E0B' },
];

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

/** A compact KPI tile. When `onPress` is given it becomes a drill-down tile
 *  (e.g. Active/Inactive tags → the filtered tags list) with a chevron. */
function KpiTile({ value, label, icon, tint, onPress }: { value: number; label: string; icon: IconName; tint: string; onPress?: () => void }) {
  const body = (
    <>
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: radius.md,
          backgroundColor: tint + '1A',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={icon} size={22} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="title">{value}</AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant}>
          {label}
        </AppText>
      </View>
      {onPress ? <Icon name="chevron-right" size={18} color={colors.onSurfaceVariant} /> : null}
    </>
  );
  const style = [
    {
      width: '47%' as const,
      flexGrow: 1,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    shadow[1],
  ];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [...style, { opacity: pressed ? 0.9 : 1 }]}>
        {body}
      </Pressable>
    );
  }
  return <View style={style}>{body}</View>;
}

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();
  const { user, appRole, can, canManageTeam } = useAuth();
  const displayName = user?.fullName?.trim() || user?.email?.split('@')[0] || 'Ngaren user';
  const { data: summary } = useResource(getSummary, summaryFallback);
  const { data: portfolio } = useResource(getFarmerPortfolio, []);
  const { data: vetMetrics } = useResource(getVetMetrics, VET_METRICS_FALLBACK);
  const { data: localAnimals } = useResource(getLocalAnimals, []);
  const { data: herd } = useResource(getHerd, []);
  const { data: callouts } = useResource(getCalloutRequests, []);
  // Devices & locations power the farmer header + tag KPIs so those counters
  // match the screens they drill into (Devices list, Farm Map) — no more
  // "Locations: 12" on the dashboard vs 4 on the map.
  const { data: devices } = useResource(getDevices, devicesFallback);
  const { data: locationList } = useResource(getLocations, locationsFallback);
  const { data: lastStock } = useResource(getLastStockTake, null);
  const { data: enlistedVets } = useResource(getEnlistedVets, []);
  // Enlisted service providers = seeded demo providers + admin-enlisted ones.
  const providerCount = seededVets.length + enlistedVets.length;

  // Stock-take/validation reporting categorized by device type (management
  // decision), across the whole live herd. Only animals whose tagging method is
  // known are classified — animal_lineage doesn't record the device model, so
  // unclassified animals aren't force-bucketed (that would be misleading).
  const deviceBreakdown = useMemo(() => {
    const counts: Record<TaggingMethod, number> = { satellite: 0, bluetooth: 0, qr: 0, manual: 0 };
    for (const a of herd) {
      const m = a.taggingMethod as TaggingMethod | undefined;
      if (m) counts[m] = (counts[m] ?? 0) + 1;
    }
    return counts;
  }, [herd]);
  const classifiedCount = useMemo(
    () => (Object.values(deviceBreakdown) as number[]).reduce((s, n) => s + n, 0),
    [deviceBreakdown],
  );
  // Pending approvals are the local captures the checker reviews on-device.
  const pendingCount = useMemo(
    () => localAnimals.filter((a) => a.approvalStatus === 'pending').length,
    [localAnimals],
  );
  // Farmer call-out awareness: how many vet requests are still in flight
  // (pending accept) or accepted and incoming. Same source the Vet Requests
  // screen reads, so the counts agree.
  const vetReqCounts = useMemo(() => {
    const active = callouts.filter((c) => c.status === 'pending' || c.status === 'accepted');
    return {
      total: active.length,
      pending: active.filter((c) => c.status === 'pending').length,
      accepted: active.filter((c) => c.status === 'accepted').length,
    };
  }, [callouts]);

  const theme = roleTheme(appRole);
  const isAdmin = appRole === 'admin';
  const isVet = appRole === 'veterinary';
  const roleActions = isAdmin ? ADMIN_ACTIONS : isVet ? VET_ACTIONS : FARMER_ACTIONS;
  // Hide actions a delegated seat member lacks the permission for; Team &
  // Payments are owner-only. Owners/solo farmers/admins see the full grid.
  // Approvals also open to a delegated Field-Operations validator.
  const canApprove = canManageTeam || can('approve_records');
  const actions = roleActions.filter((a) => {
    if (a.route === '/team' || a.route === '/payments') return canManageTeam;
    if (a.route === '/approvals') return canApprove;
    return !a.perm || can(a.perm);
  });
  // Farmer Reports grid — same permission gating as the quick actions.
  const farmerReports = FARMER_REPORTS.filter((a) => !a.perm || can(a.perm));
  const totals = portfolioTotals(portfolio);
  // Farmer tag health — derived from the SAME device list the Active/Inactive
  // tiles drill into, so the counts and the list always agree.
  const activeTags = useMemo(() => devices.filter(isTagActive).length, [devices]);
  const inactiveTags = Math.max(0, devices.length - activeTags);
  // Farmer headline counts derived from the EXACT sources the detail screens
  // read, so a dashboard counter always equals the list it drills into: herd
  // (Animals list), devices (Devices list), locations (Farm Map).
  const farmerAnimals = herd.length;
  const farmerDevices = devices.length;
  const farmerLocations = locationList.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Role-accented header (olive for admin, green for farmer). */}
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
            <Icon
              name={isAdmin ? 'shield-crown-outline' : isVet ? 'stethoscope' : 'sprout-outline'}
              size={16}
              color="#fff"
            />
            <AppText variant="caption" color="#fff" style={{ fontWeight: '700', letterSpacing: 0.5 }}>
              {t(`role.${appRole}`).toUpperCase()} · {t(`console.${appRole}`)}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <NotificationBell />
            <Pressable hitSlop={8} onPress={() => router.push('/(tabs)/profile')}>
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
            {t('home.welcome')}
          </AppText>
          <AppText variant="headline" color="#fff">
            {displayName}
          </AppText>
        </View>

        <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
          {isAdmin ? (
            <>
              <HeaderStat value={totals.farmers} label={t('home.stat.farmers')} />
              <HeaderStat value={totals.animals} label={t('home.stat.animals')} />
              <HeaderStat value={totals.devices} label={t('home.stat.devices')} />
              <HeaderStat value={totals.activeTags} label={t('home.stat.activeTags')} />
            </>
          ) : isVet ? (
            <>
              <HeaderStat value={vetMetrics.immediateAttention} label={t('home.stat.urgent')} />
              <HeaderStat value={vetMetrics.openCases} label={t('home.stat.openCases')} />
              <HeaderStat value={vetMetrics.pendingRequests} label={t('home.stat.requests')} />
            </>
          ) : (
            <>
              <HeaderStat value={farmerAnimals} label={t('home.stat.myAnimals')} />
              <HeaderStat value={farmerDevices} label={t('home.stat.devices')} />
              <HeaderStat value={farmerLocations} label={t('home.stat.locations')} />
            </>
          )}
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
        {/* Admin-only portfolio KPI band — health across all farmers. */}
        {isAdmin && (
          <>
            <AppText variant="title" style={{ marginBottom: spacing.md }}>
              {t('home.section.portfolio')}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg }}>
              <KpiTile value={totals.farmers} label={t('home.kpi.farmers')} icon="account-multiple-outline" tint="#6D874F" onPress={() => router.push('/farmers' as never)} />
              <KpiTile value={providerCount} label={t('home.kpi.providers')} icon="stethoscope" tint="#3D99F5" onPress={() => router.push('/service-vetting' as never)} />
              <KpiTile value={totals.animals} label={t('home.kpi.animals')} icon="cow" tint="#2563EB" onPress={() => router.push('/(tabs)/animals' as never)} />
              <KpiTile value={totals.needAttention} label={t('home.kpi.needAttention')} icon="alert-outline" tint="#F59E0B" onPress={() => router.push('/farmers?filter=attention' as never)} />
              <KpiTile value={totals.activeTags} label={t('home.kpi.activeTags')} icon="access-point" tint="#16A34A" onPress={() => router.push('/devices?filter=active' as never)} />
              <KpiTile value={summary.connectivity.unconnected} label={t('home.kpi.devicesOffline')} icon="access-point-off" tint="#EF4444" onPress={() => router.push('/devices?filter=inactive' as never)} />
            </View>
          </>
        )}

        {/* Vet-only clinical triage band. */}
        {isVet && (
          <>
            <AppText variant="title" style={{ marginBottom: spacing.md }}>
              {t('home.section.clinical')}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg }}>
              <KpiTile value={vetMetrics.immediateAttention} label={t('home.kpi.immediateAttention')} icon="alert-decagram-outline" tint="#EF4444" />
              <KpiTile value={vetMetrics.pendingRequests} label={t('home.kpi.pendingRequests')} icon="clipboard-clock-outline" tint="#F59E0B" />
              <KpiTile value={vetMetrics.openCases} label={t('home.kpi.openCases')} icon="folder-heart-outline" tint="#3D99F5" />
              <KpiTile value={vetMetrics.recentlyReviewed} label={t('home.kpi.reviewed')} icon="check-decagram-outline" tint="#16A34A" />
            </View>
          </>
        )}

        {/* Farmer "My Animals" summary (Oct 2026 Q&A) — total registered, the
            latest physical/visual stock take, and the live satellite tag split.
            Rows drill into the stock take and the tags list. */}
        {!isAdmin && !isVet && (
          <>
            <AppText variant="title" style={{ marginBottom: spacing.md }}>
              {t('home.section.myAnimals')}
            </AppText>
            <View style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, gap: spacing.md }, shadow[1]]}>
              {/* Total registered — tap to open the full animal list. */}
              <Pressable onPress={() => router.push('/(tabs)/animals' as never)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, opacity: pressed ? 0.9 : 1 })}>
                <View style={{ width: 46, height: 46, borderRadius: radius.md, backgroundColor: '#2563EB1A', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="cow" size={24} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>{t('home.ma.totalRegistered')}</AppText>
                  <AppText variant="headline">{farmerAnimals}</AppText>
                </View>
                <Icon name="chevron-right" size={18} color={colors.onSurfaceVariant} />
              </Pressable>

              <View style={{ height: 1, backgroundColor: colors.divider }} />

              {/* Physical & visual stock take — latest */}
              <Pressable onPress={() => router.push('/stock-take' as never)} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, gap: 4 })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Icon name="camera-outline" size={16} color="#F59E0B" />
                  <AppText variant="body" style={{ fontWeight: '600', flex: 1 }}>{t('home.ma.physicalVisual')}</AppText>
                  <Icon name="chevron-right" size={18} color={colors.onSurfaceVariant} />
                </View>
                {lastStock ? (
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    {t('home.ma.latest', { date: formatDate(lastStock.date) })} · {t('home.ma.present')} {lastStock.present} · {t('home.ma.absent')} {lastStock.absent}
                  </AppText>
                ) : (
                  <AppText variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>{t('home.ma.runStockTake')}</AppText>
                )}
              </Pressable>

              <View style={{ height: 1, backgroundColor: colors.divider }} />

              {/* Satellite stock take — live tag split */}
              <Pressable onPress={() => router.push('/devices?filter=active' as never)} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, gap: 4 })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Icon name="satellite-variant" size={16} color="#16A34A" />
                  <AppText variant="body" style={{ fontWeight: '600', flex: 1 }}>{t('home.ma.satellite')}</AppText>
                  <Icon name="chevron-right" size={18} color={colors.onSurfaceVariant} />
                </View>
                <AppText variant="caption" color={colors.onSurfaceVariant}>
                  {t('home.ma.activeTags')} {activeTags} · {t('home.ma.inactiveTags')} {inactiveTags}
                </AppText>
              </Pressable>
            </View>

            {/* Satellite / GPS tracking & monitoring (Ceres / GSat). */}
            <NavBanner
              tint="#16A34A"
              icon="map-marker-radius"
              title={t('home.satelliteTrack')}
              subtitle={t('home.satelliteTrackSub')}
              onPress={() => router.push('/(tabs)/track' as never)}
              style={{ marginBottom: spacing.lg }}
            />
          </>
        )}

        {/* Maker-checker: pending-approval prompt for approvers. */}
        {canApprove && pendingCount > 0 && (
          <NavBanner
            variant="alert"
            tint="#F59E0B"
            icon="clipboard-alert-outline"
            title={pendingCount === 1 ? t('home.banner.awaitingActivationOne') : t('home.banner.awaitingActivation', { count: pendingCount })}
            subtitle={t('home.banner.validateActivate')}
            onPress={() => router.push('/approvals' as never)}
            style={{ marginBottom: spacing.lg }}
          />
        )}

        {/* Farmer vet-request awareness: in-flight call-outs, tap to track. */}
        {!isAdmin && !isVet && can('book_vet') && vetReqCounts.total > 0 && (
          <NavBanner
            tint="#21C45D"
            icon="clipboard-pulse-outline"
            title={vetReqCounts.total === 1 ? t('home.banner.vetRequestsOne') : t('home.banner.vetRequests', { count: vetReqCounts.total })}
            subtitle={t('home.banner.vetRequestsSub', { pending: vetReqCounts.pending, accepted: vetReqCounts.accepted })}
            onPress={() => router.push('/vet-requests' as never)}
            style={{ marginBottom: spacing.lg }}
          />
        )}

        {/* Reporting categorized by device type (admin oversight). */}
        {isAdmin && classifiedCount > 0 && (
          <>
            <AppText variant="title" style={{ marginBottom: spacing.md }}>
              {t('home.section.byDevice')}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg }}>
              {(Object.keys(TAGGING_META) as TaggingMethod[]).map((m) => (
                <KpiTile
                  key={m}
                  value={deviceBreakdown[m]}
                  label={taggingMeta(m).short}
                  icon={taggingMeta(m).icon}
                  tint={m === 'satellite' ? '#16A34A' : m === 'bluetooth' ? '#0EA5E9' : m === 'qr' ? '#9333EA' : '#6D874F'}
                />
              ))}
            </View>
          </>
        )}

        {/* Documents module — generated scorecards & reports, reachable from the
            dashboard for every role (farmers/admins land here, not only vets). */}
        <NavBanner
          icon="folder-multiple-outline"
          title={t('home.banner.documents')}
          subtitle={t('home.banner.documentsSub')}
          onPress={() => router.push('/documents' as never)}
          style={{ marginBottom: spacing.lg }}
        />

        <AppText variant="title" style={{ marginBottom: spacing.md }}>
          {isAdmin ? t('home.section.controlCenter') : isVet ? t('home.section.clinicalTools') : t('home.section.quickActions')}
        </AppText>
        <ActionGrid actions={actions} />

        {/* Farmer Reports (Oct 2026 Q&A) — detailed record sets. */}
        {!isAdmin && !isVet && (
          <>
            <AppText variant="title" style={{ marginTop: spacing.lg, marginBottom: spacing.md }}>
              {t('home.section.reports')}
            </AppText>
            <ActionGrid actions={farmerReports} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
