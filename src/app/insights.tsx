import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { summary as summaryFallback } from '@/data/mock';
import { getSummary } from '@/data/api';
import { getCeresBehaviour } from '@/data/ceresBehaviour';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { useT } from '@/i18n';
import { AppText, ChartCard, DonutChart, GradientHeader, Icon, IconName, Screen } from '@/ui';

/** Compact executive KPI tile. */
function Kpi({ value, label, icon, tint }: { value: string; label: string; icon: IconName; tint: string }) {
  return (
    <View
      style={[
        { width: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
        shadow[1],
      ]}>
      <View style={{ width: 42, height: 42, borderRadius: radius.md, backgroundColor: tint + '1A', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={22} color={tint} />
      </View>
      <View>
        <AppText variant="title">{value}</AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant}>
          {label}
        </AppText>
      </View>
    </View>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }, shadow[1]]}>
      <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
          {subtitle}
        </AppText>
      ) : (
        <View style={{ height: spacing.md }} />
      )}
      {children}
    </View>
  );
}

/**
 * Admin-only Executive Analytics — device allocation, fleet connectivity and
 * aggregate herd behaviour, organised as an executive summary (KPIs first,
 * then the breakdown pies, then the trends). Farmers/vets are redirected out.
 */
export default function Insights() {
  const t = useT();
  const { isAdmin, loading, isAuthenticated } = useAuth();
  const { data: summary } = useResource(getSummary, summaryFallback);
  // Herd-wide live Ceres behaviour (no tag filter). Empty when no telemetry.
  const { data: behaviour, loading: behaviourLoading } = useResource(() => getCeresBehaviour(), []);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/(tabs)/home" />;

  const linked = summary.allocation.allocated;
  const free = summary.allocation.free;
  const online = summary.connectivity.connected;
  const offline = summary.connectivity.unconnected;
  const totalDevices = summary.devices;
  const utilisation = totalDevices ? Math.round((linked / totalDevices) * 100) : 0;
  const uptime = online + offline ? Math.round((online / (online + offline)) * 100) : 0;

  const allocation = [
    { label: t('ins.linkedToAnimals'), value: linked, color: colors.primary },
    { label: t('ins.freeDevices'), value: free, color: '#F59E0B' },
  ];
  const connectivity = [
    { label: t('ins.online'), value: online, color: colors.success },
    { label: t('ins.offline'), value: offline, color: colors.error },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('action.insights')} subtitle={t('ins.subtitle')} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {/* Executive KPI band */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg }}>
          <Kpi value={String(totalDevices)} label={t('action.devices')} icon="tag-outline" tint="#6D874F" />
          <Kpi value={String(summary.animals)} label={t('home.stat.animals')} icon="cow" tint="#2563EB" />
          <Kpi value={`${utilisation}%`} label={t('ins.tagUtil')} icon="chart-donut" tint="#0EA5E9" />
          <Kpi value={`${uptime}%`} label={t('ins.fleetUptime')} icon="access-point" tint="#16A34A" />
        </View>

        <AppText variant="title" style={{ marginBottom: spacing.md }}>
          {t('ins.deviceBreakdown')}
        </AppText>
        <SectionCard title={t('ins.deviceAllocation')} subtitle={t('ins.allocSub', { pct: utilisation })}>
          <DonutChart slices={allocation} centerLabel={t('ins.devicesCenter')} />
        </SectionCard>
        <SectionCard title={t('ins.fleetConn')} subtitle={t('ins.connSub', { pct: uptime })}>
          <DonutChart slices={connectivity} centerLabel={t('ins.devicesCenter')} />
        </SectionCard>

        <AppText variant="title" style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
          {t('ins.behaviourTrends')}
        </AppText>
        {behaviour.length > 0 ? (
          <>
            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
              {t('ins.liveTelemetry')}
            </AppText>
            {behaviour.slice(0, 3).map((series) => (
              <ChartCard key={series.label} series={series} />
            ))}
          </>
        ) : (
          <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', gap: spacing.sm }, shadow[1]]}>
            <Icon name="chart-line" size={28} color={colors.onSurfaceVariant} />
            <AppText variant="body" color={colors.onSurfaceVariant} style={{ textAlign: 'center' }}>
              {behaviourLoading ? t('ins.loadingTelemetry') : t('ins.noTelemetry')}
            </AppText>
          </View>
        )}
      </Screen>
    </View>
  );
}
