import { useEffect, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { getDeviceOrder, getFreeInventoryCount, saveFulfilment, setOrderStatus } from '@/data/deviceOrders';
import { useResource } from '@/data/hooks';
import { DeviceOrder, ORDER_STATUS_FLOW, OrderStatus, canCancel, orderProgress, statusVariant } from '@/lib/deviceOrders';
import { formatDateTime } from '@/lib/date';
import { useAuth } from '@/services/auth';
import { notify } from '@/lib/toast';
import { useT } from '@/i18n';
import { ActionChip, AppText, Button, DetailRow, EmptyState, GradientHeader, Screen, TextField } from '@/ui';

const SALES = 'sales@ngarendigital.com';
// The admin's steps, in the web's order.
const ADMIN_STEPS: OrderStatus[] = ['under_review', 'approved', 'inventory_assigned', 'processing', 'shipped', 'delivered', 'activated'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
      <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>{title}</AppText>
      {children}
    </View>
  );
}

/**
 * One device order: its details and progress. The customer can cancel while
 * it is still waiting; an admin records fulfilment and moves it along, as on
 * the web's order panel.
 */
export default function DeviceOrderDetail() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, isAuthenticated, isAdmin } = useAuth();
  const { data: order, reload, loading: busyLoad } = useResource(() => getDeviceOrder(String(id)), undefined as DeviceOrder | undefined);
  const { data: freeInventory, reload: reloadInventory } = useResource(() => (isAdmin ? getFreeInventoryCount() : Promise.resolve(0)), 0);
  // The admin's free stock, once sign-in has said they are one.
  useEffect(() => {
    if (isAdmin) reloadInventory();
  }, [isAdmin, reloadInventory]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [eta, setEta] = useState('');
  const [serials, setSerials] = useState('');

  useEffect(() => {
    if (!order) return;
    setNotes(order.admin_notes ?? '');
    setCarrier(order.shipment_carrier ?? '');
    setTracking(order.shipment_tracking_number ?? '');
    setEta(order.shipment_eta ?? '');
    setSerials((order.assigned_serials ?? []).join(', '));
  }, [order]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title={t('do.title')} showBack />
        {!busyLoad && <EmptyState icon="cart-off" title={t('do.notFound')} subtitle="" />}
      </View>
    );
  }

  const run = async (key: string, job: () => Promise<void>, done: string) => {
    setBusy(key);
    try {
      await job();
      notify(done);
      reload();
    } catch (e) {
      Alert.alert(t('do.actionFail'), e instanceof Error ? e.message : '');
    } finally {
      setBusy(null);
    }
  };

  const move = (next: OrderStatus) => run(next, () => setOrderStatus(order, next), t('do.statusSet', { status: t(`do.status.${next}`) }));

  const cancel = () =>
    Alert.alert(t('do.cancelTitle'), t('do.cancelBody', { number: order.order_number }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('do.cancelOrder'), style: 'destructive', onPress: () => move('cancelled') },
    ]);

  const emailSales = () => {
    const body = [
      `Order: ${order.order_number}`,
      `Customer: ${order.full_name}${order.organisation ? ` (${order.organisation})` : ''}`,
      `Email: ${order.email}`,
      `Phone: ${order.phone ?? '-'}`,
      `Region: ${[order.district, order.country].filter(Boolean).join(', ') || '-'}`,
      `Devices: ${order.quantity} × ${order.device_category}`,
      `Use case: ${order.use_case ?? '-'}`,
      `Deployment: ${order.preferred_deployment_date ?? '-'}`,
      `Delivery: ${order.delivery_address ?? '-'}`,
      `Notes: ${order.notes ?? '-'}`,
    ].join('\n');
    void Linking.openURL(`mailto:${SALES}?subject=${encodeURIComponent(`Device order ${order.order_number}`)}&body=${encodeURIComponent(body)}`);
  };

  const progress = orderProgress(order.status);
  const stamps: [string, string | null][] = [
    ['do.placedAt', order.created_at],
    ['do.status.approved', order.approved_at],
    ['do.status.shipped', order.shipped_at],
    ['do.status.delivered', order.delivered_at],
    ['do.status.activated', order.activated_at],
    ['do.status.cancelled', order.cancelled_at],
    ['do.status.rejected', order.rejected_at],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={order.order_number} subtitle={`${order.quantity} × ${t(`do.cat.${order.device_category}`)}`} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }} refreshing={busyLoad} onRefresh={reload}>
        <Section title={t('do.progress')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <ActionChip label={t(`do.status.${order.status}`)} variant={statusVariant(order.status)} />
            {progress !== null && <AppText variant="caption" color={colors.onSurfaceVariant}>{t('do.stepCount', { step: ORDER_STATUS_FLOW.indexOf(order.status) + 1, total: ORDER_STATUS_FLOW.length })}</AppText>}
          </View>
          {progress !== null && (
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.divider, overflow: 'hidden', marginBottom: spacing.sm }}>
              <View style={{ width: `${Math.max(4, progress * 100)}%`, height: 6, backgroundColor: colors.primary }} />
            </View>
          )}
          {stamps.filter(([, at]) => !!at).map(([k, at], i, arr) => (
            <DetailRow key={k} label={t(k)} value={formatDateTime(at)} last={i === arr.length - 1} />
          ))}
          {!!order.rejection_reason && <AppText variant="caption" color={colors.error}>{order.rejection_reason}</AppText>}
        </Section>

        <Section title={t('do.details')}>
          <DetailRow label={t('do.fullName')} value={order.full_name} />
          {!!order.organisation && <DetailRow label={t('do.organisation')} value={order.organisation} />}
          <DetailRow label={t('do.email')} value={order.email} />
          {!!order.phone && <DetailRow label={t('do.phone')} value={order.phone} />}
          <DetailRow label={t('do.region')} value={[order.district, order.country].filter(Boolean).join(', ') || '—'} />
          <DetailRow label={t('do.livestock')} value={order.livestock_type ?? '—'} />
          {order.estimated_herd_size != null && <DetailRow label={t('do.herdSize')} value={String(order.estimated_herd_size)} />}
          <DetailRow label={t('do.useCase')} value={order.use_case ?? '—'} />
          <DetailRow label={t('do.deployment')} value={order.preferred_deployment_date ?? '—'} />
          <DetailRow label={t('do.address')} value={order.delivery_address ?? '—'} />
          <DetailRow label={t('do.contactVia')} value={t(`do.contact.${order.preferred_contact_method ?? 'email'}`)} last={!order.notes} />
          {!!order.notes && <DetailRow label={t('ad.notes')} value={order.notes} last />}
        </Section>

        {(order.shipment_carrier || order.shipment_tracking_number || order.shipment_eta || (order.assigned_serials ?? []).length > 0) && (
          <Section title={t('do.shipment')}>
            {!!order.shipment_carrier && <DetailRow label={t('do.carrier')} value={order.shipment_carrier} />}
            {!!order.shipment_tracking_number && <DetailRow label={t('do.tracking')} value={order.shipment_tracking_number} />}
            {!!order.shipment_eta && <DetailRow label={t('do.eta')} value={order.shipment_eta} />}
            {(order.assigned_serials ?? []).length > 0 && <DetailRow label={t('do.serials')} value={(order.assigned_serials ?? []).join(', ')} last />}
          </Section>
        )}

        {!isAdmin && canCancel(order) && (
          <Button label={t('do.cancelOrder')} icon="close-circle-outline" variant="outline" loading={busy === 'cancelled'} disabled={!!busy} onPress={cancel} />
        )}

        {isAdmin && (
          <Section title={t('do.fulfilment')}>
            {(order.preferred_contact_method ?? 'email') === 'email' && (
              <Button label={t('do.forwardSales', { email: SALES })} icon="email-outline" variant="outline" onPress={emailSales} style={{ marginBottom: spacing.md }} />
            )}
            <TextField label={t('do.adminNotes')} value={notes} onChangeText={setNotes} multiline />
            <TextField label={t('do.carrier')} value={carrier} onChangeText={setCarrier} />
            <TextField label={t('do.tracking')} value={tracking} onChangeText={setTracking} />
            <TextField label={t('do.eta')} value={eta} onChangeText={setEta} placeholder="YYYY-MM-DD" />
            <TextField label={t('do.serialsInput', { count: order.quantity })} value={serials} onChangeText={setSerials} multiline />
            <Button
              label={t('do.saveFulfilment')}
              icon="content-save-outline"
              variant="outline"
              loading={busy === 'save'}
              disabled={!!busy}
              onPress={() => run('save', () => saveFulfilment(order, { adminNotes: notes, carrier, tracking, eta, serials }), t('do.saved'))}
              style={{ marginBottom: spacing.md }}
            />
            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
              {t('do.inventoryFree', { count: freeInventory })}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {ADMIN_STEPS.map((s) => (
                <Button
                  key={s}
                  label={t(`do.action.${s}`)}
                  loading={busy === s}
                  // As on the web, approval waits until there is enough free stock.
                  disabled={!!busy || order.status === s || (s === 'approved' && freeInventory < order.quantity)}
                  onPress={() => move(s)}
                  style={{ flexGrow: 1 }}
                />
              ))}
              <Button label={t('do.action.rejected')} variant="danger" loading={busy === 'rejected'} disabled={!!busy || order.status === 'rejected'} onPress={() => move('rejected')} style={{ flexGrow: 1 }} />
            </View>
          </Section>
        )}
      </Screen>
    </View>
  );
}
