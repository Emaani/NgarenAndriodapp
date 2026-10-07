import { useState } from 'react';
import { View } from 'react-native';
import { colors, radius, shadow, spacing } from '@/theme';
import { currentPlanId, invoices, plans } from '@/data/mock';
import { Plan } from '@/data/types';
import { useT, useTStatus } from '@/i18n';
import { ActionChip, AppText, Button, GradientHeader, Icon, IconChip, Screen } from '@/ui';

function PlanCard({ plan, active, onSelect }: { plan: Plan; active: boolean; onSelect: () => void }) {
  const t = useT();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.mdMinus,
          borderWidth: active ? 2 : 1,
          borderColor: active ? colors.primary : colors.divider,
          gap: spacing.sm,
        },
        shadow[1],
      ]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="title">{plan.name}</AppText>
        {active && <ActionChip label={t('pay.currentPlan')} variant="success" />}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
        <AppText variant="headline" color={colors.primary}>
          {plan.priceLabel}
        </AppText>
        {!!plan.cadence && (
          <AppText variant="body" color={colors.onSurfaceVariant} style={{ marginBottom: 3 }}>
            {plan.cadence}
          </AppText>
        )}
      </View>
      <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
        {plan.features.map((f) => (
          <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="check-circle" size={16} color={colors.success} />
            <AppText variant="body" color={colors.onSurfaceVariant}>
              {f}
            </AppText>
          </View>
        ))}
      </View>
      {!active && (
        <Button
          label={t('pay.switchTo', { plan: plan.name })}
          variant="outline"
          onPress={onSelect}
          style={{ marginTop: spacing.sm }}
        />
      )}
    </View>
  );
}

export default function Payments() {
  const t = useT();
  const tStatus = useTStatus();
  const [selected, setSelected] = useState(currentPlanId);
  const current = plans.find((p) => p.id === selected) ?? plans[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('profile.row.paymentsSubscription')} subtitle={t('pay.subtitle', { plan: current.name })} showBack>
        <View style={{ marginTop: spacing.md, alignItems: 'center' }}>
          <AppText variant="caption" color="rgba(255,255,255,0.85)">
            {t('pay.nextRenewal')}
          </AppText>
          <AppText variant="bodyLarge" color="#fff" style={{ fontWeight: '600' }}>
            01 Jul 2026 · {current.priceLabel}
            {current.cadence}
          </AppText>
        </View>
      </GradientHeader>

      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          {t('pay.paymentMethod')}
        </AppText>
        <View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              padding: spacing.md,
              marginBottom: spacing.lg,
              borderWidth: 1,
              borderColor: colors.divider,
            },
            shadow[1],
          ]}>
          <IconChip icon="credit-card-outline" />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
              MTN Mobile Money
            </AppText>
            <AppText variant="caption" color={colors.onSurfaceVariant}>
              **** **** 4242
            </AppText>
          </View>
          <ActionChip label={t('pay.default')} variant="info" dot={false} />
        </View>

        <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          {t('pay.plans')}
        </AppText>
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} active={p.id === selected} onSelect={() => setSelected(p.id)} />
        ))}

        <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
          {t('pay.billingHistory')}
        </AppText>
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>
          {invoices.map((inv, i) => (
            <View
              key={inv.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: spacing.md,
                borderBottomWidth: i === invoices.length - 1 ? 0 : 1,
                borderBottomColor: colors.divider,
              }}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyLarge">{inv.amount}</AppText>
                <AppText variant="caption" color={colors.onSurfaceVariant}>
                  {inv.date}
                </AppText>
              </View>
              <ActionChip label={tStatus(inv.status)} variant={inv.status === 'Paid' ? 'success' : 'warning'} />
            </View>
          ))}
        </View>

        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ textAlign: 'center', marginTop: spacing.lg }}>
          {t('pay.manageNote')}
        </AppText>
      </Screen>
    </View>
  );
}
