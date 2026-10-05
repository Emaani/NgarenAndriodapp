import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { getHealthRecords, HealthCategory } from '@/data/clinical';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { formatDate } from '@/lib/date';
import { useT, useTStatus } from '@/i18n';
import { ActionChip, AppText, EmptyState, GradientHeader, Icon, IconChip, IconName, Screen } from '@/ui';

// labelKey holds an i18n key; translated at render.
const CATEGORY_META: Record<HealthCategory, { labelKey: string; icon: IconName; tint: string }> = {
  parasite: { labelKey: 'health.cat.parasite', icon: 'bug-outline', tint: '#F59E0B' },
  disease: { labelKey: 'health.cat.disease', icon: 'virus-outline', tint: '#EF4444' },
  reproduction: { labelKey: 'health.cat.reproduction', icon: 'heart-pulse', tint: '#EC4899' },
  disorder: { labelKey: 'health.cat.disorder', icon: 'alert-circle-outline', tint: '#9333EA' },
};

type Filter = 'all' | HealthCategory;

function statusVariant(status: string) {
  const s = status.toLowerCase();
  if (s === 'resolved') return 'success' as const;
  if (s === 'ongoing') return 'warning' as const;
  return 'neutral' as const;
}

/** A compact managed-health workflow shortcut. */
function ActionTile({ icon, label, sublabel, tint, onPress }: { icon: IconName; label: string; sublabel: string; tint: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { flexGrow: 1, flexBasis: '47%', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: colors.divider, opacity: pressed ? 0.9 : 1 },
        shadow[1],
      ]}>
      <View style={{ width: 34, height: 34, borderRadius: radius.full, backgroundColor: tint + '1A', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={tint} />
      </View>
      <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>
        {label}
      </AppText>
      <AppText variant="caption" color={colors.onSurfaceVariant}>
        {sublabel}
      </AppText>
    </Pressable>
  );
}

/**
 * Managed Health — the farmer's hub for professional animal health. Per the
 * Aug 29 2026 standup, requesting a vet lives here: the farmer can request a
 * nearby (5 km) vet and browse vet persona profiles, alongside the calendar,
 * breeding/repro, their open requests, and the clinical record history.
 */
export default function Health() {
  const router = useRouter();
  const t = useT();
  const tStatus = useTStatus();
  const { loading, isAuthenticated, can } = useAuth();
  const { data: records } = useResource(getHealthRecords, []);
  const [filter, setFilter] = useState<Filter>('all');

  const filters = useMemo<{ key: Filter }[]>(
    () => [{ key: 'all' }, { key: 'disease' }, { key: 'parasite' }, { key: 'reproduction' }, { key: 'disorder' }],
    [],
  );

  const visible = useMemo(
    () => (filter === 'all' ? records : records.filter((r) => r.category === filter)),
    [records, filter],
  );
  const ongoing = records.filter((r) => r.status.toLowerCase() === 'ongoing').length;
  const canBookVet = can('book_vet');

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('action.managedHealth')} subtitle={t('health.subtitle', { count: records.length, ongoing })} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {/* Request a Vet — the primary managed-health action (Uber-for-vets). */}
        {canBookVet ? (
          <Pressable
            onPress={() => router.push('/find-vet')}
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, opacity: pressed ? 0.92 : 1 },
              shadow[1],
            ]}>
            <View style={{ width: 46, height: 46, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="stethoscope" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyLarge" color="#fff" style={{ fontWeight: '700' }}>
                {t('health.requestVet')}
              </AppText>
              <AppText variant="caption" color="rgba(255,255,255,0.9)">
                {t('health.requestVetSub')}
              </AppText>
            </View>
            <Icon name="chevron-right" size={22} color="#fff" />
          </Pressable>
        ) : null}

        {/* Managed-health workflows, all reachable from this tab. */}
        {/* Breeding/lineage deferred to Phase 2 (Sep 3 2026 standup) — the MVP
            focuses on the managed-health workflow. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
          <ActionTile icon="calendar-month-outline" label={t('action.calendar')} sublabel={t('health.tileCalendarSub')} tint="#0EA5E9" onPress={() => router.push('/calendar')} />
          {canBookVet ? (
            <ActionTile icon="clipboard-pulse-outline" label={t('health.tileRequests')} sublabel={t('health.tileRequestsSub')} tint="#EF4444" onPress={() => router.push('/vet-requests')} />
          ) : null}
          <ActionTile icon="cow" label={t('health.tileAnimals')} sublabel={t('health.tileAnimalsSub')} tint="#16A34A" onPress={() => router.push('/(tabs)/animals')} />
        </View>

        {/* Clinical record history */}
        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          {t('health.records')}
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md }}>
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
                  {t(`health.cat.${f.key}`)}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {visible.length === 0 ? (
          <EmptyState icon="heart-pulse" title={t('health.emptyTitle')} subtitle={t('health.emptySub')} />
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
                      {t(meta.labelKey)}
                      {r.vetName ? ` · ${r.vetName}` : ''}
                    </AppText>
                  </View>
                  <ActionChip label={tStatus(r.status)} variant={statusVariant(r.status)} />
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
                        {t('health.followUp', { date: formatDate(r.followUpDate) })}
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
