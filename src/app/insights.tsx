import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { summary as summaryFallback, behaviourSeries as behaviourFallback } from '@/data/mock';
import { getSummary, getAnimalBehaviour } from '@/data/api';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { AppText, ChartCard, DonutChart, GradientHeader, Screen } from '@/ui';

function Legend({ items }: { items: { label: string; value: number; color: string }[] }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: it.color }} />
          <AppText variant="body" style={{ flex: 1 }}>
            {it.label}
          </AppText>
          <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>
            {it.value}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function InsightCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }, shadow[1]]}>
      <AppText variant="bodyLarge" style={{ fontWeight: '600', marginBottom: spacing.md }}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

/**
 * Admin-only analytics — an executive read of device allocation, connectivity
 * and aggregate herd behaviour. Farmers/vets are redirected out (matching the
 * Command Center, where Insights is admin-only).
 */
export default function Insights() {
  const { isAdmin, loading, isAuthenticated } = useAuth();
  const { data: summary } = useResource(getSummary, summaryFallback);
  const { data: behaviour } = useResource(() => getAnimalBehaviour(0), behaviourFallback);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/(tabs)/home" />;

  const allocation = [
    { label: 'Linked animals', value: summary.allocation.allocated, color: colors.primary },
    { label: 'Free devices', value: summary.allocation.free, color: '#F59E0B' },
  ];
  const connectivity = [
    { label: 'Online', value: summary.connectivity.connected, color: colors.success },
    { label: 'Offline', value: summary.connectivity.unconnected, color: colors.error },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Insights" subtitle="Executive analytics" showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <InsightCard title="Device allocation">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <DonutChart slices={allocation} />
            <View style={{ flex: 1 }}>
              <Legend items={allocation} />
            </View>
          </View>
        </InsightCard>

        <InsightCard title="Fleet connectivity">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <DonutChart slices={connectivity} />
            <View style={{ flex: 1 }}>
              <Legend items={connectivity} />
            </View>
          </View>
        </InsightCard>

        <AppText variant="title" style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
          Herd behaviour trends
        </AppText>
        {behaviour.slice(0, 3).map((series) => (
          <ChartCard key={series.label} series={series} />
        ))}
      </Screen>
    </View>
  );
}
