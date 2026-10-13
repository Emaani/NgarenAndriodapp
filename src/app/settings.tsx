import { Linking, Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { colors, radius, shadow, spacing } from '@/theme';
import { useAuth } from '@/services/auth';
import { useT } from '@/i18n';
import { AppText, GradientHeader, Icon, IconName, Screen } from '@/ui';

const NGAREN_SUPPORT_TEL = '+256200000000';

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
  const t = useT();
  const { loading, isAuthenticated, isAdmin, appRole, signOut, canManageTeam } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const version = Constants.expoConfig?.version ?? '1.0.0';

  const onLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const preferences: Row[] = [
    { icon: 'account-outline', label: t('settings.row.editProfile'), route: '/edit-profile', onPress: () => router.push('/edit-profile') },
    { icon: 'lock-reset', label: t('settings.row.changePassword'), onPress: () => router.push('/change-password' as never) },
    { icon: 'bell-cog-outline', label: t('settings.row.notificationPrefs'), onPress: () => router.push('/notification-settings') },
    { icon: 'message-outline', label: t('settings.row.messages'), onPress: () => router.push('/messaging' as never) },
  ];

  const adminRows: Row[] = [
    { icon: 'account-group-outline', label: t('settings.row.teamUsers'), onPress: () => router.push('/users' as never) },
    { icon: 'alert-octagon-outline', label: t('settings.row.incidentsSla'), onPress: () => router.push('/incidents' as never) },
  ];

  // Billing + Service support live on the account (Oct 2026 Q&A) — off the
  // dashboard. The provider/farmer contact label flips with the role.
  const isVet = appRole === 'veterinary';
  const billing: Row[] = [
    { icon: 'wallet-outline', label: t('settings.row.payments'), onPress: () => router.push('/payments' as never) },
  ];
  const support: Row[] = [
    { icon: 'message-text-outline', label: t('settings.row.messageNgaren'), onPress: () => router.push('/compose-message?to=ngaren' as never) },
    { icon: 'phone-outline', label: t('settings.row.callNgaren'), onPress: () => { Linking.openURL(`tel:${NGAREN_SUPPORT_TEL}`).catch(() => {}); } },
    { icon: 'message-reply-text-outline', label: t(isVet ? 'settings.row.contactFarmer' : 'settings.row.contactProvider'), onPress: () => router.push(isVet ? '/compose-message?to=farmer' as never : '/messaging' as never) },
  ];
  // Secondary destinations moved off the decluttered dashboard (Oct 2026 Q&A).
  const more: Row[] = [
    { icon: 'storefront-outline', label: t('action.marketplace'), onPress: () => router.push('/marketplace' as never) },
    ...(canManageTeam ? [{ icon: 'account-group-outline' as IconName, label: t('action.teamSeats'), onPress: () => router.push('/team' as never) }] : []),
  ];

  const about: Row[] = [
    { icon: 'shield-account-outline', label: t('settings.row.role'), value: t(`role.${appRole}`) },
    { icon: 'information-outline', label: t('settings.row.appVersion'), value: version },
    { icon: 'satellite-variant', label: t('settings.row.poweredBy'), value: 'Ceres Tag' },
    { icon: 'help-circle-outline', label: t('settings.row.helpSupport'), onPress: () => router.push('/help') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('profile.row.settings')} subtitle={t(`console.${appRole}`)} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <Section title={t('settings.section.preferences')} rows={preferences} />
        <Section title={t('settings.section.billing')} rows={billing} />
        <Section title={t('settings.section.support')} rows={support} />
        <Section title={t('settings.section.more')} rows={more} />
        {isAdmin && <Section title={t('settings.section.administration')} rows={adminRows} />}
        <Section title={t('settings.section.about')} rows={about} />
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>
          <SettingsRow row={{ icon: 'logout', label: t('common.logOut'), destructive: true, onPress: onLogout }} last />
        </View>
      </Screen>
    </View>
  );
}
