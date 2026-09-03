import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
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
  const { loading, isAuthenticated, can } = useAuth();
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
  const canBookVet = can('book_vet');

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Managed Health" subtitle={`${records.length} records · ${ongoing} ongoing`} showBack />
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
                Request a Vet
              </AppText>
              <AppText variant="caption" color="rgba(255,255,255,0.9)">
                Browse nearby vet profiles & book — for the farm or a specific animal.
              </AppText>
            </View>
            <Icon name="chevron-right" size={22} color="#fff" />
          </Pressable>
        ) : null}

        {/* Managed-health workflows, all reachable from this tab. */}
        {/* Breeding/lineage deferred to Phase 2 (Sep 3 2026 standup) — the MVP
            focuses on the managed-health workflow. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
          <ActionTile icon="calendar-month-outline" label="Calendar" sublabel="Visits, vaccinations, follow-ups" tint="#0EA5E9" onPress={() => router.push('/calendar')} />
          {canBookVet ? (
            <ActionTile icon="clipboard-pulse-outline" label="My vet requests" sublabel="Track call-out status" tint="#EF4444" onPress={() => router.push('/vet-requests')} />
          ) : null}
          <ActionTile icon="cow" label="My animals" sublabel="Open an animal to log health" tint="#16A34A" onPress={() => router.push('/(tabs)/animals')} />
        </View>

        {/* Clinical record history */}
        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          Health records
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
                  {f.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

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
