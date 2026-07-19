import { Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { colors, radius, shadow, spacing } from '@/theme';
import { useAuth } from '@/services/auth';
import { roleTheme } from '@/lib/roles';
import { AppText, GradientHeader, Icon, IconName, Screen } from '@/ui';

type Row = { icon: IconName; label: string; value?: string; route?: string; destructive?: boolean; onPress?: () => void };

function SettingsRow({ row, last }: { row: Row; last?: boolean }) {
  return (
    <Pressable
      onPress={row.onPress}
      disabled={!row.onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.divider,
      }}>
      <Icon name={row.icon} size={22} color={row.destructive ? colors.error : colors.primary} />
      <AppText variant="bodyLarge" color={row.destructive ? colors.error : colors.onSurface} style={{ flex: 1, fontWeight: row.destructive ? '600' : '400' }}>
        {row.label}
      </AppText>
      {row.value ? (
        <AppText variant="body" color={colors.onSurfaceVariant}>
          {row.value}
        </AppText>
      ) : row.onPress ? (
        <Icon name="chevron-right" size={22} color={colors.onSurfaceVariant} />
      ) : null}
    </Pressable>
  );
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm, textTransform: 'uppercase' }}>
        {title}
      </AppText>
      <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>
        {rows.map((r, i) => (
          <SettingsRow key={r.label} row={r} last={i === rows.length - 1} />
        ))}
      </View>
    </View>
  );
}

export default function Settings() {
  const router = useRouter();
  const { loading, isAuthenticated, isAdmin, displayRole, appRole, signOut } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const theme = roleTheme(appRole);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const onLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const preferences: Row[] = [
    { icon: 'account-outline', label: 'Edit Profile', route: '/edit-profile', onPress: () => router.push('/edit-profile') },
    { icon: 'bell-cog-outline', label: 'Notification Preferences', onPress: () => router.push('/notification-settings') },
    { icon: 'message-outline', label: 'Messages', onPress: () => router.push('/messaging' as never) },
  ];

  const adminRows: Row[] = [
    { icon: 'account-group-outline', label: 'Team & Users', onPress: () => router.push('/users' as never) },
    { icon: 'alert-octagon-outline', label: 'Incidents & SLA', onPress: () => router.push('/incidents' as never) },
  ];

  const about: Row[] = [
    { icon: 'shield-account-outline', label: 'Role', value: displayRole },
    { icon: 'information-outline', label: 'App version', value: version },
    { icon: 'satellite-variant', label: 'Powered by', value: 'Ceres Tag' },
    { icon: 'help-circle-outline', label: 'Help & Support', onPress: () => router.push('/help') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Settings" subtitle={theme.consoleTitle} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <Section title="Preferences" rows={preferences} />
        {isAdmin && <Section title="Administration" rows={adminRows} />}
        <Section title="About" rows={about} />
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>
          <SettingsRow row={{ icon: 'logout', label: 'Log Out', destructive: true, onPress: onLogout }} last />
        </View>
      </Screen>
    </View>
  );
}
