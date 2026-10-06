import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { notifications as notificationsFallback } from '@/data/mock';
import { getNotifications } from '@/data/api';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { useT } from '@/i18n';
import { ActionChip, AppText, EmptyState, GradientHeader, Icon, IconChip, Screen } from '@/ui';

/**
 * Admin-only alert history — the organisation-wide feed of device-activity and
 * boundary (geofence) alerts, mirroring the Command Center's Alert History
 * page. Farmers/vets are redirected out.
 */
export default function Alerts() {
  const t = useT();
  const { isAdmin, loading, isAuthenticated } = useAuth();
  const { data: alerts } = useResource(() => getNotifications(0, 100), notificationsFallback);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/(tabs)/home" />;

  const boundary = alerts.filter((a) => a.category === 'boundary').length;
  const device = alerts.filter((a) => a.category === 'device').length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('action.alertHistory')} subtitle={t('alr.subtitle', { count: alerts.length, boundary, device })} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {alerts.length === 0 ? (
          <EmptyState icon="check-circle-outline" title={t('alr.emptyTitle')} subtitle={t('alr.emptySub')} />
        ) : (
          alerts.map((a) => {
            const isBoundary = a.category === 'boundary';
            return (
              <View
                key={a.id}
                style={[
                  {
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: spacing.mdMinus,
                    backgroundColor: colors.surface,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    marginBottom: spacing.sm,
                    borderLeftWidth: 3,
                    borderLeftColor: isBoundary ? colors.error : '#F59E0B',
                  },
                  shadow[1],
                ]}>
                <IconChip
                  icon={isBoundary ? 'fence' : 'flash'}
                  bg={isBoundary ? colors.errorTint : '#FEF3C7'}
                  fg={isBoundary ? colors.error : '#B45309'}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                      {a.title}
                    </AppText>
                    <ActionChip
                      label={isBoundary ? t('alr.geofence') : t('alr.device')}
                      variant={isBoundary ? 'error' : 'warning'}
                    />
                  </View>
                  <AppText variant="body" color={colors.onSurface}>
                    {a.message}
                  </AppText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Icon name="clock-outline" size={13} color={colors.onSurfaceVariant} />
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      {a.timestamp}
                    </AppText>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </Screen>
    </View>
  );
}
