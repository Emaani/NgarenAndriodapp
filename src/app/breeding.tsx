import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { getBreedingRecords } from '@/data/clinical';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { formatDate } from '@/lib/date';
import { ActionChip, AppText, EmptyState, GradientHeader, Icon, IconChip, Screen } from '@/ui';

type Filter = 'all' | 'pending' | 'confirmed' | 'calved';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'calved', label: 'Calved' },
];

function statusVariant(status: string) {
  const s = status.toLowerCase();
  if (s === 'calved') return 'info' as const;
  if (s === 'confirmed') return 'success' as const;
  return 'warning' as const;
}

export default function Breeding() {
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
      <GradientHeader title="Breeding" subtitle="Lineage, mating & pregnancy" showBack />
      <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, paddingBottom: 0, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.full,
                backgroundColor: active ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.divider,
              }}>
              <AppText variant="body" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                {f.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {visible.length === 0 ? (
          <EmptyState icon="dna" title="No breeding records" subtitle="Mating and pregnancy records will appear here." />
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
                      Sire: {r.sireName} · {r.matingMethod}
                    </AppText>
                  </View>
                </View>
                <ActionChip label={r.status[0].toUpperCase() + r.status.slice(1)} variant={statusVariant(r.status)} />
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Icon name="calendar-heart" size={15} color={colors.onSurfaceVariant} />
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    Mated {formatDate(r.matingDate)}
                  </AppText>
                </View>
                {r.expectedCalvingDate && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Icon name="baby-carriage" size={15} color={colors.onSurfaceVariant} />
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      Due {formatDate(r.expectedCalvingDate)}
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
