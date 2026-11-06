import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { getDeviceOrders } from '@/data/deviceOrders';
import { useResource } from '@/data/hooks';
import { isSupabaseConfigured } from '@/config';
import { DeviceOrder, ORDER_STATUS_FLOW, OrderStatus, orderProgress, statusVariant } from '@/lib/deviceOrders';
import { useAuth } from '@/services/auth';
import { useT } from '@/i18n';
import { ActionChip, AppText, Button, EmptyState, GradientHeader, Screen, formatIsoDate } from '@/ui';

const FILTERS: ('all' | OrderStatus)[] = ['all', ...ORDER_STATUS_FLOW, 'cancelled', 'rejected'];

/**
 * Device orders — the account's orders for CERES, GPS, Bluetooth and RFID
 * devices, or every order for an admin, as on the web's Devices page.
 */
export default function DeviceOrders() {
  const router = useRouter();
  const t = useT();
  const { loading, isAuthenticated, user, isAdmin } = useAuth();
  const { data: orders, loading: busy, reload } = useResource(() => getDeviceOrders({ all: isAdmin, userId: user?.id }), [] as DeviceOrder[]);
  useFocusEffect(useCallback(() => reload(), [reload]));
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');

  const shown = useMemo(() => (filter === 'all' ? orders : orders.filter((o) => o.status === filter)), [orders, filter]);
  const stats = useMemo(
    () => ({
      pending: orders.filter((o) => o.status === 'pending' || o.status === 'under_review').length,
      delivered: orders.filter((o) => o.status === 'delivered' || o.status === 'activated').length,
    }),
    [orders],
  );

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader
        title={isAdmin ? t('do.allTitle') : t('do.title')}
        subtitle={t('do.subtitle', { count: orders.length, pending: stats.pending, delivered: stats.delivered })}
        showBack
      />
      <Screen contentStyle={{ paddingTop: spacing.md }} refreshing={busy} onRefresh={reload}>
        {isSupabaseConfigured() && (
          <Button label={t('do.orderTitle')} icon="cart-plus" onPress={() => router.push('/order-devices' as never)} style={{ marginBottom: spacing.md }} />
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }} contentContainerStyle={{ gap: spacing.sm }}>
          {FILTERS.map((f) => {
            const on = filter === f;
            const count = f === 'all' ? orders.length : orders.filter((o) => o.status === f).length;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.divider }}>
                <AppText variant="caption" color={on ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                  {f === 'all' ? t('dev.filterAll') : t(`do.status.${f}`)} ({count})
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>

        {!isSupabaseConfigured() ? (
          <EmptyState icon="cart-outline" title={t('do.demoTitle')} subtitle={t('do.demoSub')} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon="cart-outline"
            title={filter === 'all' ? t('do.emptyTitle') : t('do.emptyFiltered')}
            subtitle={filter === 'all' ? t('do.emptySub') : ''}
          />
        ) : (
          shown.map((o) => {
            const progress = orderProgress(o.status);
            return (
              <Pressable
                key={o.id}
                onPress={() => router.push(`/device-order/${o.id}` as never)}
                style={({ pressed }) => [{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.xs, opacity: pressed ? 0.9 : 1 }, shadow[1]]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
                  <AppText variant="bodyLarge" style={{ fontWeight: '600', flexShrink: 1 }}>{o.order_number}</AppText>
                  <ActionChip label={t(`do.status.${o.status}`)} variant={statusVariant(o.status)} />
                </View>
                <AppText variant="body">{`${o.quantity} × ${t(`do.cat.${o.device_category}`)}`}</AppText>
                <AppText variant="caption" color={colors.onSurfaceVariant}>
                  {isAdmin ? `${o.full_name}${o.organisation ? ` · ${o.organisation}` : ''} · ` : ''}
                  {formatIsoDate(o.created_at)}
                </AppText>
                {progress !== null && (
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.divider, overflow: 'hidden', marginTop: spacing.xs }}>
                    <View style={{ width: `${Math.max(4, progress * 100)}%`, height: 4, backgroundColor: colors.primary }} />
                  </View>
                )}
              </Pressable>
            );
          })
        )}
      </Screen>
    </View>
  );
}
