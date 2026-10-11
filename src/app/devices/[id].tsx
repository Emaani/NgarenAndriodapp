import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { devices as devicesFallback } from '@/data/mock';
import { getDeviceById } from '@/data/api';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { formatDate } from '@/lib/date';
import { useT } from '@/i18n';
import { ActionChip, AppText, Button, DetailRow, GradientHeader, Icon, Screen } from '@/ui';

/**
 * Tag (device) detail — reached by drilling down from the Active/Inactive tag
 * tiles on the dashboard and from the Devices list. Shows the full tag record
 * (serial, model, firmware, power, activation, temperature) and whether it is
 * linked to an animal, with a jump to that animal. Consistent across profiles.
 */
export default function TagDetail() {
  const router = useRouter();
  const t = useT();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { loading, isAuthenticated } = useAuth();
  const numericId = Number(id);
  const fallback = devicesFallback.find((d) => d.id === numericId);
  const { data: device } = useResource(() => getDeviceById(numericId), fallback);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const active = !!device && (device.linkedAnimalId !== null || device.linkedAnimalTag !== null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('dev.tagDetail')} subtitle={device?.serial} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {!device ? (
          <AppText variant="body" color={colors.onSurfaceVariant}>
            {t('dev.emptyTitle')}
          </AppText>
        ) : (
          <>
            {/* Status banner. */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                backgroundColor: active ? colors.successTint : colors.warningTint,
                borderRadius: radius.md,
                padding: spacing.md,
                marginBottom: spacing.md,
              }}>
              <Icon name={active ? 'access-point' : 'access-point-off'} size={20} color={active ? colors.success : colors.warning} />
              <AppText variant="body" style={{ fontWeight: '700', flex: 1 }} color={active ? colors.success : colors.warning}>
                {active ? t('dev.active') : t('dev.inactive')}
              </AppText>
              <ActionChip label={device.brand} variant="neutral" />
            </View>

            <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>
              <DetailRow label={t('dev.serial')} value={device.serial} />
              <DetailRow label={t('dev.model')} value={device.model} />
              <DetailRow label={t('dev.family')} value={device.family} />
              <DetailRow label={t('dev.brand')} value={device.brand} />
              <DetailRow label={t('dev.firmware')} value={device.firmware} />
              <DetailRow label={t('dev.chargeType')} value={device.chargeType} />
              <DetailRow label={t('dev.activated')} value={device.activatedAt ? formatDate(device.activatedAt) : '—'} />
              <DetailRow
                label={t('dev.temperature')}
                value={typeof device.temperatureC === 'number' ? `${device.temperatureC}°C` : '—'}
              />
              <DetailRow
                label={t('dev.linkedAnimal')}
                value={device.linkedAnimalTag ?? t('dev.notLinked')}
                last
              />
            </View>

            {device.linkedAnimalId ? (
              <Button
                label={t('dev.viewAnimal')}
                icon="cow"
                onPress={() => router.push(`/animals/${device.linkedAnimalId}` as never)}
                style={{ marginTop: spacing.lg }}
              />
            ) : (
              <Button
                label={t('common.regNewAnimal')}
                icon="plus"
                variant="outline"
                onPress={() => router.push('/register-animal' as never)}
                style={{ marginTop: spacing.lg }}
              />
            )}
          </>
        )}
      </Screen>
    </View>
  );
}
