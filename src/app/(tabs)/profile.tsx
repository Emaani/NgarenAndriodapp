import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { useAuth } from '@/services/auth';
import { AppText, GradientHeader, Icon, IconName, Screen } from '@/ui';

type Row = { icon: IconName; label: string; route?: string; tint?: string };

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: 'Account',
    rows: [
      { icon: 'account-outline', label: 'Edit Profile' },
      { icon: 'map-marker-outline', label: 'My Locations' },
      { icon: 'tag-outline', label: 'My Devices' },
    ],
  },
  {
    title: 'Billing',
    rows: [
      { icon: 'wallet-outline', label: 'Payments & Subscription', route: '/payments', tint: '#9333EA' },
      { icon: 'receipt', label: 'Billing History', route: '/payments' },
    ],
  },
  {
    title: 'Support',
    rows: [
      { icon: 'bell-outline', label: 'Notifications', route: '/notifications' },
      { icon: 'cog-outline', label: 'Notification Preferences', route: '/notification-settings' },
      { icon: 'help-circle-outline', label: 'Help & Support' },
    ],
  },
];

function MenuRow({ row, onPress, last }: { row: Row; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.divider,
      }}>
      <Icon name={row.icon} size={22} color={row.tint ?? colors.primary} />
      <AppText variant="bodyLarge" style={{ flex: 1 }}>
        {row.label}
      </AppText>
      <Icon name="chevron-right" size={22} color={colors.onSurfaceVariant} />
    </Pressable>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Profile() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const displayName = user?.fullName?.trim() || user?.email?.split('@')[0] || 'Ngaren user';
  const displayEmail = user?.email ?? '';

  const onLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader>
        <View style={{ alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: radius.full,
              backgroundColor: 'rgba(255,255,255,0.25)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <AppText style={{ color: '#fff', fontWeight: '700', fontSize: 28 }}>{initials(displayName)}</AppText>
          </View>
          <AppText variant="title" color="#fff">
            {displayName}
          </AppText>
          {!!displayEmail && (
            <AppText variant="body" color="rgba(255,255,255,0.92)">
              {displayEmail}
            </AppText>
          )}
        </View>
      </GradientHeader>

      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {SECTIONS.map((section) => (
          <View key={section.title} style={{ marginBottom: spacing.lg }}>
            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm, textTransform: 'uppercase' }}>
              {section.title}
            </AppText>
            <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>
              {section.rows.map((row, i) => (
                <MenuRow
                  key={row.label}
                  row={row}
                  last={i === section.rows.length - 1}
                  onPress={() => (row.route ? router.push(row.route as never) : undefined)}
                />
              ))}
            </View>
          </View>
        ))}

        <Pressable
          onPress={onLogout}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
          <Icon name="logout" size={20} color={colors.error} />
          <AppText variant="bodyLarge" color={colors.error} style={{ fontWeight: '600' }}>
            Log Out
          </AppText>
        </Pressable>
      </Screen>
    </View>
  );
}
