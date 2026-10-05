import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { getBreedingRecords } from '@/data/clinical';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { formatDate } from '@/lib/date';
import { useT, useTStatus } from '@/i18n';
import { ActionChip, AppText, EmptyState, GradientHeader, Icon, IconChip, Screen } from '@/ui';

type Filter = 'all' | 'pending' | 'confirmed' | 'calved';

const FILTERS: Filter[] = ['all', 'pending', 'confirmed', 'calved'];

function statusVariant(status: string) {
  const s = status.toLowerCase();
  if (s === 'calved') return 'info' as const;
  if (s === 'confirmed') return 'success' as const;
  return 'warning' as const;
}

export default function Breeding() {
  const t = useT();
  const tStatus = useTStatus();
  const { loading, isAuthenticated } = useAuth();
  const { data: records } = useResource(getBreedingRecords, []);
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(
    () => (filter === 'all' ? records : records.filter((r) => r.status.toLowerCase() === filter)),
    [records, filter],
  );

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

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

      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {visible.length === 0 ? (
          <EmptyState icon="dna" title={t('brd.emptyTitle')} subtitle={t('brd.emptySub')} />
        ) : (
          visible.map((r) => (
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

              <View style={{ flexDirection: 'row', gap: spacing.lg }}>
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
              </View>

              {!!r.notes && (
                <AppText variant="body" color={colors.onSurface}>
                  {r.notes}
                </AppText>
              )}
            </View>
          ))
        )}
      </Screen>
    </View>
  );
}
