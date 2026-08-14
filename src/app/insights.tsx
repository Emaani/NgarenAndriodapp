import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { summary as summaryFallback, behaviourSeries as behaviourFallback } from '@/data/mock';
import { getSummary, getAnimalBehaviour } from '@/data/api';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
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
  const { isAdmin, loading, isAuthenticated } = useAuth();
  const { data: summary } = useResource(getSummary, summaryFallback);
  const { data: behaviour } = useResource(() => getAnimalBehaviour(0), behaviourFallback);

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
    { label: 'Linked to animals', value: linked, color: colors.primary },
    { label: 'Free devices', value: free, color: '#F59E0B' },
  ];
  const connectivity = [
    { label: 'Online', value: online, color: colors.success },
    { label: 'Offline', value: offline, color: colors.error },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Insights" subtitle="Executive analytics" showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {/* Executive KPI band */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg }}>
          <Kpi value={String(totalDevices)} label="Devices" icon="tag-outline" tint="#6D874F" />
          <Kpi value={String(summary.animals)} label="Animals" icon="cow" tint="#2563EB" />
          <Kpi value={`${utilisation}%`} label="Tag utilisation" icon="chart-donut" tint="#0EA5E9" />
          <Kpi value={`${uptime}%`} label="Fleet uptime" icon="access-point" tint="#16A34A" />
        </View>

        <AppText variant="title" style={{ marginBottom: spacing.md }}>
          Device breakdown
        </AppText>
        <SectionCard title="Device allocation" subtitle={`${utilisation}% of devices are linked to an animal`}>
          <DonutChart slices={allocation} centerLabel="devices" />
        </SectionCard>
        <SectionCard title="Fleet connectivity" subtitle={`${uptime}% of the fleet is currently online`}>
          <DonutChart slices={connectivity} centerLabel="devices" />
        </SectionCard>

        <AppText variant="title" style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
          Herd behaviour trends
        </AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
          Drag any chart to inspect a reading.
        </AppText>
        {behaviour.slice(0, 3).map((series) => (
          <ChartCard key={series.label} series={series} />
        ))}
      </Screen>
    </View>
  );
}
