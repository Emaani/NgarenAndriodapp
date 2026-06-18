import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { summary } from '@/data/mock';
import { useAuth } from '@/services/auth';
import { AppText, GradientHeader, Icon, IconName, NotificationBell } from '@/ui';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type Action = { icon: IconName; label: string; route: string; tint: string };

const ACTIONS: Action[] = [
  { icon: 'stethoscope', label: 'Find a Vet', route: '/find-vet', tint: '#21C45D' },
  { icon: 'plus-circle-outline', label: 'Register Animal', route: '/register-animal', tint: '#6D874F' },
  { icon: 'clipboard-check-outline', label: 'Stock Take', route: '/stock-take', tint: '#F59E0B' },
  { icon: 'cow', label: 'View Animals', route: '/(tabs)/animals', tint: '#2563EB' },
  { icon: 'map-marker-radius', label: 'Track Animals', route: '/(tabs)/track', tint: '#16A34A' },
  { icon: 'wallet-outline', label: 'Payments', route: '/payments', tint: '#9333EA' },
];

function Stat({ value, label }: { value: number; label: string }) {
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

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const displayName = user?.fullName?.trim() || user?.email?.split('@')[0] || 'Ngaren user';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader
        right={
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
        }>
        <View style={{ marginTop: spacing.xs }}>
          <AppText variant="bodyLarge" color="rgba(255,255,255,0.9)">
            Welcome back,
          </AppText>
          <AppText variant="headline" color="#fff">
            {displayName}
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
          <Stat value={summary.animals} label="Animals" />
          <Stat value={summary.devices} label="Devices" />
          <Stat value={summary.locations} label="Locations" />
        </View>
      </GradientHeader>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
        <AppText variant="title" style={{ marginBottom: spacing.md }}>
          Quick actions
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {ACTIONS.map((a) => (
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
