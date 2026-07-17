import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { getHealthRecords, HealthCategory } from '@/data/clinical';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { formatDate } from '@/lib/date';
import { ActionChip, AppText, EmptyState, GradientHeader, Icon, IconChip, IconName, Screen } from '@/ui';

const CATEGORY_META: Record<HealthCategory, { label: string; icon: IconName; tint: string }> = {
  parasite: { label: 'Parasite', icon: 'bug-outline', tint: '#F59E0B' },
  disease: { label: 'Disease', icon: 'virus-outline', tint: '#EF4444' },
  reproduction: { label: 'Reproduction', icon: 'heart-pulse', tint: '#EC4899' },
  disorder: { label: 'Disorder', icon: 'alert-circle-outline', tint: '#9333EA' },
};

type Filter = 'all' | HealthCategory;

function statusVariant(status: string) {
  const s = status.toLowerCase();
  if (s === 'resolved') return 'success' as const;
  if (s === 'ongoing') return 'warning' as const;
  return 'neutral' as const;
}

export default function Health() {
  const { loading, isAuthenticated } = useAuth();
  const { data: records } = useResource(getHealthRecords, []);
  const [filter, setFilter] = useState<Filter>('all');

  const filters = useMemo<{ key: Filter; label: string }[]>(
    () => [
      { key: 'all', label: 'All' },
      { key: 'disease', label: 'Disease' },
      { key: 'parasite', label: 'Parasite' },
      { key: 'reproduction', label: 'Reproduction' },
      { key: 'disorder', label: 'Disorder' },
    ],
    [],
  );

  const visible = useMemo(
    () => (filter === 'all' ? records : records.filter((r) => r.category === filter)),
    [records, filter],
  );
  const ongoing = records.filter((r) => r.status.toLowerCase() === 'ongoing').length;

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Managed Health" subtitle={`${records.length} records · ${ongoing} ongoing`} showBack />
      <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, paddingBottom: 0, flexWrap: 'wrap' }}>
        {filters.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={{
                paddingHorizontal: spacing.mdMinus,
                paddingVertical: spacing.sm,
                borderRadius: radius.full,
                backgroundColor: active ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.divider,
              }}>
              <AppText variant="caption" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                {f.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {visible.length === 0 ? (
          <EmptyState icon="heart-pulse" title="No health records" subtitle="Vaccinations, treatments and check-ups appear here." />
        ) : (
          visible.map((r) => {
            const meta = CATEGORY_META[r.category];
            return (
              <View
                key={r.id}
                style={[
                  { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, borderLeftWidth: 3, borderLeftColor: meta.tint },
                  shadow[1],
                ]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus }}>
                  <IconChip icon={meta.icon} bg={meta.tint + '1A'} fg={meta.tint} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                      {r.animalName}
                    </AppText>
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      {meta.label}
                      {r.vetName ? ` · ${r.vetName}` : ''}
                    </AppText>
                  </View>
                  <ActionChip label={r.status[0].toUpperCase() + r.status.slice(1)} variant={statusVariant(r.status)} />
                </View>

                {!!r.notes && (
                  <AppText variant="body" color={colors.onSurface}>
                    {r.notes}
                  </AppText>
                )}

                <View style={{ flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' }}>
                  {!!r.medication && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Icon name="pill" size={15} color={colors.onSurfaceVariant} />
                      <AppText variant="caption" color={colors.onSurfaceVariant}>
                        {r.medication}
                      </AppText>
                    </View>
                  )}
                  {!!r.followUpDate && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Icon name="calendar-clock" size={15} color={colors.onSurfaceVariant} />
                      <AppText variant="caption" color={colors.onSurfaceVariant}>
                        Follow-up {formatDate(r.followUpDate)}
                      </AppText>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </Screen>
    </View>
  );
}
