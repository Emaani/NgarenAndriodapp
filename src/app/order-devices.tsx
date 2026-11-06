import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { placeDeviceOrder } from '@/data/deviceOrders';
import { CONTACT_METHODS, DEVICE_CATEGORIES, LIVESTOCK, OrderForm, USE_CASES, emptyOrderForm, orderProblem } from '@/lib/deviceOrders';
import { useAuth } from '@/services/auth';
import { notify } from '@/lib/toast';
import { useT } from '@/i18n';
import { AppText, Button, DatePickerField, DetailRow, GradientHeader, PickerField, Screen, TextField } from '@/ui';

const STEPS = ['customer', 'devices', 'delivery', 'review'] as const;

/**
 * Order devices — the web's four-step order wizard: customer, devices,
 * delivery, review. The order goes to `device_orders` as pending, and the
 * admins are told through the notify-device-order function.
 */
export default function OrderDevices() {
  const router = useRouter();
  const t = useT();
  const { loading, isAuthenticated, user } = useAuth();
  const [form, setForm] = useState<OrderForm>(() => emptyOrderForm({ fullName: user?.fullName, email: user?.email }));
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  if (loading) return null;
  if (!isAuthenticated || !user) return <Redirect href="/login" />;

  const set = <K extends keyof OrderForm>(k: K, v: OrderForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const problem = orderProblem(form);
  const stepOk = step === 0 ? problem !== 'name' && problem !== 'email' : step === 1 ? problem !== 'quantity' : true;

  const submit = async () => {
    if (problem) return;
    setSaving(true);
    try {
      const order = await placeDeviceOrder(form, user.id);
      notify(t('do.placed', { number: order.order_number }));
      router.replace(`/device-order/${order.id}` as never);
    } catch (e) {
      Alert.alert(t('do.placeFail'), e instanceof Error ? e.message : '');
    } finally {
      setSaving(false);
    }
  };

  const categoryLabel = (c: string) => t(`do.cat.${c}`);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('do.orderTitle')} subtitle={t('do.stepOf', { step: step + 1, total: STEPS.length, name: t(`do.step.${STEPS[step]}`) })} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md }}>
          {STEPS.map((s, i) => (
            <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? colors.primary : colors.divider }} />
          ))}
        </View>

        {step === 0 && (
          <>
            <TextField label={t('do.fullName')} required value={form.full_name} onChangeText={(v) => set('full_name', v)} />
            <TextField label={t('do.organisation')} value={form.organisation} onChangeText={(v) => set('organisation', v)} />
            <TextField label={t('do.email')} required keyboardType="email-address" value={form.email} onChangeText={(v) => set('email', v)} />
            <TextField label={t('do.phone')} keyboardType="phone-pad" value={form.phone} onChangeText={(v) => set('phone', v)} placeholder="+256…" />
            <TextField label={t('do.country')} value={form.country} onChangeText={(v) => set('country', v)} />
            <TextField label={t('do.district')} value={form.district} onChangeText={(v) => set('district', v)} />
          </>
        )}

        {step === 1 && (
          <>
            <PickerField
              label={t('do.category')}
              required
              value={form.device_category}
              options={DEVICE_CATEGORIES.map((c) => ({ label: categoryLabel(c), value: c }))}
              onSelect={(v) => set('device_category', v as OrderForm['device_category'])}
            />
            <TextField label={t('do.quantity')} required keyboardType="numeric" value={form.quantity} onChangeText={(v) => set('quantity', v.replace(/[^0-9]/g, ''))} />
            <PickerField label={t('do.livestock')} value={form.livestock_type} options={LIVESTOCK.map((l) => ({ label: l, value: l }))} onSelect={(v) => set('livestock_type', v)} />
            <TextField label={t('do.herdSize')} keyboardType="numeric" value={form.estimated_herd_size} onChangeText={(v) => set('estimated_herd_size', v.replace(/[^0-9]/g, ''))} />
            <DatePickerField label={t('do.deployment')} value={form.preferred_deployment_date} onSelect={(iso) => set('preferred_deployment_date', iso.slice(0, 10))} />
            <PickerField label={t('do.useCase')} value={form.use_case} options={USE_CASES.map((u) => ({ label: u, value: u }))} onSelect={(v) => set('use_case', v)} />
          </>
        )}

        {step === 2 && (
          <>
            <TextField label={t('do.address')} value={form.delivery_address} onChangeText={(v) => set('delivery_address', v)} multiline />
            <AppText variant="body" style={{ marginBottom: spacing.sm }}>{t('do.contactVia')}</AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              {CONTACT_METHODS.map((m) => {
                const on = form.preferred_contact_method === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => set('preferred_contact_method', m)}
                    style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.divider }}>
                    <AppText variant="caption" color={on ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>{t(`do.contact.${m}`)}</AppText>
                  </Pressable>
                );
              })}
            </View>
            <TextField label={t('ad.notes')} value={form.notes} onChangeText={(v) => set('notes', v)} multiline />
          </>
        )}

        {step === 3 && (
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
            <DetailRow label={t('do.fullName')} value={form.full_name} />
            {!!form.organisation && <DetailRow label={t('do.organisation')} value={form.organisation} />}
            <DetailRow label={t('do.email')} value={form.email} />
            {!!form.phone && <DetailRow label={t('do.phone')} value={form.phone} />}
            <DetailRow label={t('do.region')} value={[form.district, form.country].filter(Boolean).join(', ') || '—'} />
            <DetailRow label={t('do.devices')} value={`${form.quantity} × ${categoryLabel(form.device_category)}`} />
            <DetailRow label={t('do.livestock')} value={form.livestock_type} />
            <DetailRow label={t('do.useCase')} value={form.use_case} />
            <DetailRow label={t('do.deployment')} value={form.preferred_deployment_date || '—'} />
            <DetailRow label={t('do.address')} value={form.delivery_address || '—'} />
            <DetailRow label={t('do.contactVia')} value={t(`do.contact.${form.preferred_contact_method}`)} />
          </View>
        )}

        {problem && step === 3 && <AppText variant="caption" color={colors.error} style={{ marginBottom: spacing.sm }}>{t(`do.problem.${problem}`)}</AppText>}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {step > 0 && <Button label={t('do.back')} variant="outline" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
          {step < STEPS.length - 1 ? (
            <Button label={t('do.next')} disabled={!stepOk} onPress={() => setStep(step + 1)} style={{ flex: 1 }} />
          ) : (
            <Button label={t('do.submit')} icon="send-outline" loading={saving} disabled={!!problem || saving} onPress={submit} style={{ flex: 1 }} />
          )}
        </View>
        {!stepOk && step < 2 && <AppText variant="caption" color={colors.error} style={{ marginTop: spacing.sm }}>{t(`do.problem.${problem}`)}</AppText>}
      </Screen>
    </View>
  );
}
