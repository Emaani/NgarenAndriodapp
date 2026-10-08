import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { getBreedingRecords } from '@/data/clinical';
import {
  confirmPregnancy,
  getLocalBreedingRecords,
  isLocalBreeding,
  recordCalving,
} from '@/data/localBreeding';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { notify } from '@/lib/toast';
import { formatDate } from '@/lib/date';
import { useT, useTStatus } from '@/i18n';
import { ActionChip, AppText, Button, EmptyState, Fab, GradientHeader, Icon, IconChip, Screen } from '@/ui';

type Filter = 'all' | 'pending' | 'confirmed' | 'calved';

const FILTERS: Filter[] = ['all', 'pending', 'confirmed', 'calved'];

function statusVariant(status: string) {
  const s = status.toLowerCase();
  if (s === 'calved') return 'info' as const;
  if (s === 'confirmed') return 'success' as const;
  return 'warning' as const;
}

export default function Breeding() {
  const router = useRouter();
  const t = useT();
  const tStatus = useTStatus();
  const { loading, isAuthenticated } = useAuth();
  // Local captures first, then mock/remote — a live, editable breeding list.
  const { data: records, reload } = useResource(
    async () => {
      const [local, remote] = await Promise.all([getLocalBreedingRecords(), getBreedingRecords()]);
      return [...local, ...remote];
    },
    [],
  );
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(
    () => (filter === 'all' ? records : records.filter((r) => r.status.toLowerCase() === filter)),
    [records, filter],
  );

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const onConfirm = async (id: string) => {
    await confirmPregnancy(id);
    notify(t('brd.confirmedToast'));
    reload();
  };

  const onCalving = (id: string) => {
    Alert.alert(t('brd.calvingTitle'), t('brd.calvingBody'), [
      { text: t('brd.oneCalf'), onPress: () => void recordCalving(id, 1).then(() => { notify(t('brd.calvedToast')); reload(); }) },
      { text: t('brd.twins'), onPress: () => void recordCalving(id, 2).then(() => { notify(t('brd.calvedToast')); reload(); }) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('action.breeding')} subtitle={t('brd.subtitle')} showBack />
      <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, paddingBottom: 0, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const active = filter === f;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.full,
                backgroundColor: active ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.divider,
              }}>
              <AppText variant="body" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                {f === 'all' ? t('doc.all') : tStatus(f)}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl + 72 }}>
        {visible.length === 0 ? (
          <EmptyState icon="dna" title={t('brd.emptyTitle')} subtitle={t('brd.emptySub')} />
        ) : (
          visible.map((r) => {
            const local = isLocalBreeding(r.id);
            const status = r.status.toLowerCase();
            return (
              <View
                key={r.id}
                style={[
                  { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, borderWidth: 1, borderColor: colors.divider },
                  shadow[1],
                ]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus, flex: 1 }}>
                    <IconChip icon="dna" />
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                        {r.damName}
                      </AppText>
                      <AppText variant="caption" color={colors.onSurfaceVariant}>
                        {t('brd.sire', { name: r.sireName, method: r.matingMethod })}
                      </AppText>
                    </View>
                  </View>
                  <ActionChip label={tStatus(r.status)} variant={statusVariant(r.status)} />
                </View>

                <View style={{ flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Icon name="calendar-heart" size={15} color={colors.onSurfaceVariant} />
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      {t('brd.mated', { date: formatDate(r.matingDate) })}
                    </AppText>
                  </View>
                  {r.expectedCalvingDate && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Icon name="baby-carriage" size={15} color={colors.onSurfaceVariant} />
                      <AppText variant="caption" color={colors.onSurfaceVariant}>
                        {t('brd.due', { date: formatDate(r.expectedCalvingDate) })}
                      </AppText>
                    </View>
                  )}
                  {status === 'calved' && r.offspringCount > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Icon name="cow" size={15} color={colors.onSurfaceVariant} />
                      <AppText variant="caption" color={colors.onSurfaceVariant}>
                        {r.offspringCount === 1 ? t('brd.offspringOne') : t('brd.offspring', { count: r.offspringCount })}
                      </AppText>
                    </View>
                  )}
                </View>

                {!!r.notes && (
                  <AppText variant="body" color={colors.onSurface}>
                    {r.notes}
                  </AppText>
                )}

                {/* Lifecycle actions for locally-captured records. */}
                {local && status === 'pending' ? (
                  <Button label={t('brd.confirmPreg')} icon="check-decagram-outline" variant="outline" onPress={() => onConfirm(r.id)} />
                ) : null}
                {local && status === 'confirmed' ? (
                  <Button label={t('brd.recordCalving')} icon="baby-carriage" variant="outline" onPress={() => onCalving(r.id)} />
                ) : null}
              </View>
            );
          })
        )}
      </Screen>

      <Fab icon="plus" onPress={() => router.push('/add-breeding' as never)} />
    </View>
  );
}
