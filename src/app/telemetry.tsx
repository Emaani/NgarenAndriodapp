import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { MOCK as telemetryFallback, getTelemetryAnalytics } from '@/data/telemetry';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { AppText, DonutChart, GradientHeader, Icon, IconName, LineChart, Screen } from '@/ui';

const PALETTE = ['#6D874F', '#0EA5E9', '#F59E0B', '#EC4899', '#EF4444', '#16A34A'];
const DAYS = ['6d', '5d', '4d', '3d', '2d', '1d', 'Now'];

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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg }, shadow[1]]}>
      <AppText variant="bodyLarge" style={{ fontWeight: '600', marginBottom: spacing.md }}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

/**
 * Telemetry Analytics (Admin) — 7-day aggregate of Ceres Tag activity,
 * behaviour split and device battery health. Reads `ceres_telemetry` directly
 * with a mock fallback; mirrors the web TelemetryAnalyticsPage.
 */
export default function Telemetry() {
  const { loading, isAuthenticated, isAdmin } = useAuth();
  const { data: t } = useResource(getTelemetryAnalytics, telemetryFallback);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/(tabs)/home" />;

  const slices = t.behaviour.map((b, i) => ({ label: b.label, value: b.value, color: PALETTE[i % PALETTE.length] }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Telemetry Analytics" subtitle="Last 7 days · Ceres Tag" showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <Kpi value={t.pings.toLocaleString()} label="Telemetry pings" icon="access-point" tint="#6D874F" />
          <Kpi value={String(t.activeTags)} label="Reporting tags" icon="tag-outline" tint="#0EA5E9" />
          <Kpi value={`${t.avgActivity}%`} label="Avg activity" icon="run-fast" tint="#F59E0B" />
          <Kpi value={String(t.lowBattery)} label="Low battery" icon="battery-alert" tint="#EF4444" />
        </View>

        <Card title="Activity trend">
          {t.activityByDay.some((v) => v > 0) ? (
            <>
              <LineChart actual={t.activityByDay} pfi={[]} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
                {DAYS.map((d) => (
                  <AppText key={d} variant="caption" color={colors.onSurfaceVariant}>
                    {d}
                  </AppText>
                ))}
              </View>
            </>
          ) : (
            <AppText variant="body" color={colors.onSurfaceVariant}>
              No activity telemetry in the last 7 days.
            </AppText>
          )}
        </Card>

        <Card title="Behaviour split">
          {slices.length > 0 ? (
            <DonutChart slices={slices} />
          ) : (
            <AppText variant="body" color={colors.onSurfaceVariant}>
              No behaviour data reported yet.
            </AppText>
          )}
        </Card>

        <Card title="Device battery health">
          {t.batteries.length === 0 ? (
            <AppText variant="body" color={colors.onSurfaceVariant}>
              No devices reporting battery.
            </AppText>
          ) : (
            t.batteries.map((b, i) => {
              const tint = b.battery < 20 ? colors.error : b.battery < 50 ? colors.warning : colors.success;
              return (
                <View
                  key={b.tag}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingVertical: spacing.sm,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.divider,
                  }}>
                  <Icon name="tag-outline" size={18} color={colors.onSurfaceVariant} />
                  <AppText variant="body" style={{ flex: 1 }}>
                    {b.tag}
                  </AppText>
                  <View style={{ width: 90, height: 8, borderRadius: radius.full, backgroundColor: colors.divider, overflow: 'hidden' }}>
                    <View style={{ width: `${b.battery}%`, height: '100%', backgroundColor: tint }} />
                  </View>
                  <AppText variant="caption" color={tint} style={{ fontWeight: '700', width: 38, textAlign: 'right' }}>
                    {b.battery}%
                  </AppText>
                </View>
              );
            })
          )}
        </Card>
      </Screen>
    </View>
  );
}
