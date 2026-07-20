import { Pressable, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing } from '@/theme';
import { summary as summaryFallback } from '@/data/mock';
import { getSummary } from '@/data/api';
import { getFarmerPortfolio, portfolioTotals } from '@/data/portfolio';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { roleTheme } from '@/lib/roles';
import { AppText, Icon, IconName, NotificationBell } from '@/ui';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type Action = { icon: IconName; label: string; route: string; tint: string };

// Farmer "Herd Operations Console" — day-to-day herd work.
const FARMER_ACTIONS: Action[] = [
  { icon: 'stethoscope', label: 'Find a Vet', route: '/find-vet', tint: '#21C45D' },
  { icon: 'clipboard-pulse-outline', label: 'Vet Requests', route: '/vet-requests', tint: '#EF4444' },
  { icon: 'plus-circle-outline', label: 'Register Animal', route: '/register-animal', tint: '#6D874F' },
  { icon: 'dna', label: 'Breeding', route: '/breeding', tint: '#EC4899' },
  { icon: 'heart-pulse', label: 'Managed Health', route: '/health', tint: '#EF4444' },
  { icon: 'calendar-month-outline', label: 'Calendar', route: '/calendar', tint: '#0EA5E9' },
  { icon: 'clipboard-check-outline', label: 'Stock Take', route: '/stock-take', tint: '#F59E0B' },
  { icon: 'cow', label: 'View Animals', route: '/(tabs)/animals', tint: '#2563EB' },
  { icon: 'map-marker-radius', label: 'Track Animals', route: '/(tabs)/track', tint: '#16A34A' },
  { icon: 'storefront-outline', label: 'Marketplace', route: '/marketplace', tint: '#0D9488' },
  { icon: 'wallet-outline', label: 'Payments', route: '/payments', tint: '#9333EA' },
];

// Admin "Enterprise Control Center" — organisation-wide oversight tools that a
// farmer does not get (mirrors the Command Center's adminNav superset).
const ADMIN_ACTIONS: Action[] = [
  { icon: 'account-multiple-outline', label: 'Farmers Portfolio', route: '/farmers', tint: '#6D874F' },
  { icon: 'cow', label: 'Livestock', route: '/(tabs)/animals', tint: '#2563EB' },
  { icon: 'map-marker-radius', label: 'Track', route: '/(tabs)/track', tint: '#16A34A' },
  { icon: 'chart-box-outline', label: 'Insights', route: '/insights', tint: '#0D9488' },
  { icon: 'chart-timeline-variant', label: 'Telemetry', route: '/telemetry', tint: '#0EA5E9' },
  { icon: 'file-chart-outline', label: 'Reports', route: '/reports', tint: '#6D874F' },
  { icon: 'storefront-outline', label: 'Marketplace', route: '/marketplace', tint: '#0D9488' },
  { icon: 'cloud-alert', label: 'Alert History', route: '/alerts', tint: '#EF4444' },
  { icon: 'dna', label: 'Breeding', route: '/breeding', tint: '#EC4899' },
  { icon: 'heart-pulse', label: 'Managed Health', route: '/health', tint: '#DC2626' },
  { icon: 'calendar-month-outline', label: 'Calendar', route: '/calendar', tint: '#0EA5E9' },
  { icon: 'account-group-outline', label: 'Team & Users', route: '/users', tint: '#0284C7' },
  { icon: 'clipboard-pulse-outline', label: 'Vet Call-outs', route: '/vet', tint: '#F59E0B' },
  { icon: 'tag-outline', label: 'Devices', route: '/devices', tint: '#9333EA' },
  { icon: 'map-marker-outline', label: 'Locations', route: '/locations', tint: '#0D9488' },
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

/** A compact KPI tile used in the admin executive summary. */
function KpiTile({ value, label, icon, tint }: { value: number; label: string; icon: IconName; tint: string }) {
  return (
    <View
      style={[
        {
          width: '47%',
          flexGrow: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: spacing.md,
        },
        shadow[1],
      ]}>
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
      <View>
        <AppText variant="title">{value}</AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant}>
          {label}
        </AppText>
      </View>
    </View>
  );
}

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, appRole } = useAuth();
  const displayName = user?.fullName?.trim() || user?.email?.split('@')[0] || 'Ngaren user';
  const { data: summary } = useResource(getSummary, summaryFallback);
  const { data: portfolio } = useResource(getFarmerPortfolio, []);

  const theme = roleTheme(appRole);
  const isAdmin = appRole === 'admin';
  const actions = isAdmin ? ADMIN_ACTIONS : FARMER_ACTIONS;
  const linkedDevices = Math.max(0, summary.devices - summary.connectivity.unconnected);
  const totals = portfolioTotals(portfolio);
  // Farmer tag health for the "My Farm" insight band.
  const activeTags = summary.allocation.allocated;
  const inactiveTags = Math.max(0, summary.devices - activeTags);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Role-accented header (olive for admin, green for farmer). */}
      <LinearGradient
        colors={[theme.accent, '#698A3B']}
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
            <Icon name={isAdmin ? 'shield-crown-outline' : 'sprout-outline'} size={16} color="#fff" />
            <AppText variant="caption" color="#fff" style={{ fontWeight: '700', letterSpacing: 0.5 }}>
              {theme.label.toUpperCase()} · {theme.consoleTitle}
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
            Welcome back,
          </AppText>
          <AppText variant="headline" color="#fff">
            {displayName}
          </AppText>
        </View>

        <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
          {isAdmin ? (
            <>
              <HeaderStat value={totals.farmers} label="Farmers" />
              <HeaderStat value={totals.animals} label="Animals" />
              <HeaderStat value={totals.devices} label="Devices" />
              <HeaderStat value={totals.activeTags} label="Active tags" />
            </>
          ) : (
            <>
              <HeaderStat value={summary.animals} label="My Animals" />
              <HeaderStat value={summary.devices} label="Devices" />
              <HeaderStat value={summary.locations} label="Locations" />
            </>
          )}
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
        {/* Admin-only portfolio KPI band — health across all farmers. */}
        {isAdmin && (
          <>
            <AppText variant="title" style={{ marginBottom: spacing.md }}>
              Portfolio overview
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg }}>
              <KpiTile value={totals.farmers} label="Farmers" icon="account-multiple-outline" tint="#6D874F" />
              <KpiTile value={totals.needAttention} label="Need attention" icon="alert-outline" tint="#F59E0B" />
              <KpiTile value={totals.activeTags} label="Active tags" icon="access-point" tint="#16A34A" />
              <KpiTile value={summary.connectivity.unconnected} label="Devices offline" icon="access-point-off" tint="#EF4444" />
            </View>
          </>
        )}

        {/* Farmer-only tag-health insight band (per tester feedback). */}
        {!isAdmin && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg }}>
            <KpiTile value={activeTags} label="Active tags" icon="access-point" tint="#16A34A" />
            <KpiTile value={inactiveTags} label="Inactive tags" icon="access-point-off" tint="#F59E0B" />
          </View>
        )}

        <AppText variant="title" style={{ marginBottom: spacing.md }}>
          {isAdmin ? 'Control center' : 'Quick actions'}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => router.push(a.route as never)}
              style={({ pressed }) => [
                {
                  width: '47%',
                  flexGrow: 1,
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  gap: spacing.sm,
                  opacity: pressed ? 0.9 : 1,
                },
                shadow[1],
              ]}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.md,
                  backgroundColor: a.tint + '1A',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon name={a.icon} size={26} color={a.tint} />
              </View>
              <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                {a.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
