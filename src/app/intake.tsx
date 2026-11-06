import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { IntakeEntry, getHerdIntake } from '@/data/intake';
import { useResource } from '@/data/hooks';
import { isSupabaseConfigured } from '@/config';
import { useAuth } from '@/services/auth';
import { useT } from '@/i18n';
import { ActionChip, AppText, EmptyState, GradientHeader, Icon, Screen } from '@/ui';

type Filter = 'all' | 'at_risk' | 'optimal';

const riskColor = (e: IntakeEntry) => (e.risk === 'low' ? colors.success : e.risk === 'medium' ? colors.warning : colors.error);

function Kpi({ value, label, tint }: { value: string; label: string; tint: string }) {
  return (
    <View style={[{ width: '47%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md }, shadow[1]]}>
      <AppText variant="title" color={tint}>{value}</AppText>
      <AppText variant="caption" color={colors.onSurfaceVariant}>{label}</AppText>
    </View>
  );
}

/**
 * Intake Intelligence — dry-matter intake against what each animal should eat,
 * from CERES daily summaries, as on the web. Each row says whether the intake
 * was measured by the tag or estimated, and where the weight came from.
 */
export default function Intake() {
  const t = useT();
  const router = useRouter();
  const { loading, isAuthenticated, appRole } = useAuth();
  const { data: entries, loading: busy, reload } = useResource(getHerdIntake, []);
  const [filter, setFilter] = useState<Filter>('all');

  const stats = useMemo(() => {
    const n = entries.length;
    return {
      n,
      measured: entries.filter((e) => e.dmiSource === 'measured').length,
      atRisk: entries.filter((e) => e.adequacyPct < 80).length,
      optimal: entries.filter((e) => e.adequacyPct >= 90).length,
      avg: n ? Math.round(entries.reduce((s, e) => s + e.adequacyPct, 0) / n) : 0,
    };
  }, [entries]);

  const shown = useMemo(() => {
    const list = filter === 'at_risk' ? entries.filter((e) => e.adequacyPct < 80) : filter === 'optimal' ? entries.filter((e) => e.adequacyPct >= 90) : entries;
    return [...list].sort((a, b) => a.adequacyPct - b.adequacyPct);
  }, [entries, filter]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (appRole === 'veterinary') return <Redirect href="/(tabs)/home" />;

  const FILTERS: Filter[] = ['all', 'at_risk', 'optimal'];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('ii.title')} subtitle={t('ii.subtitle')} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }} refreshing={busy} onRefresh={reload}>
        {!isSupabaseConfigured() ? (
          <EmptyState icon="grass" title={t('ii.demoTitle')} subtitle={t('ii.demoSub')} />
        ) : entries.length === 0 ? (
          <EmptyState icon="grass" title={t('ii.emptyTitle')} subtitle={t('ii.emptySub')} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
              <Kpi value={String(stats.n)} label={t('ii.assessed', { measured: stats.measured })} tint={colors.onSurface} />
              <Kpi value={`${stats.avg}%`} label={t('ii.avgAdequacy')} tint={colors.primary} />
              <Kpi value={String(stats.atRisk)} label={t('ii.atRisk')} tint={colors.error} />
              <Kpi value={String(stats.optimal)} label={t('ii.optimal')} tint={colors.success} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
              <Icon name="information-outline" size={18} color={colors.primary} />
              <AppText variant="caption" color={colors.primaryDark} style={{ flex: 1 }}>{t('ii.method')}</AppText>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              {FILTERS.map((f) => {
                const on = filter === f;
                return (
                  <Pressable
                    key={f}
                    onPress={() => setFilter(f)}
                    style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.divider }}>
                    <AppText variant="caption" color={on ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>{t(`ii.filter.${f}`)}</AppText>
                  </Pressable>
                );
              })}
            </View>

            {shown.map((e) => (
              <Pressable
                key={e.animalId}
                onPress={() => router.push(`/animals/${e.animalId}`)}
                style={({ pressed }) => [{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.xs, opacity: pressed ? 0.9 : 1 }, shadow[1]]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{e.label}</AppText>
                    <AppText variant="caption" color={colors.onSurfaceVariant}>{e.breed ?? t('reg.unknown')}</AppText>
                  </View>
                  <AppText variant="title" color={riskColor(e)}>{Math.round(e.adequacyPct)}%</AppText>
                </View>
                {/* Adequacy bar, capped at 100% wide. */}
                <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.divider, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.min(100, e.adequacyPct)}%`, height: 6, backgroundColor: riskColor(e) }} />
                </View>
                <AppText variant="body">
                  {t('ii.dmiLine', { dmi: e.dmiKg.toFixed(1), expected: e.expectedDmiKg.toFixed(1) })}
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  <ActionChip label={e.dmiSource === 'measured' ? t('ii.measured') : t('ii.estimated')} variant={e.dmiSource === 'measured' ? 'info' : 'neutral'} />
                  <ActionChip label={t(`ii.risk.${e.risk}`)} variant={e.risk === 'low' ? 'success' : e.risk === 'medium' ? 'warning' : 'error'} />
                  {e.ruminationDropPct !== null && e.ruminationDropPct > 15 && <ActionChip label={t('ii.ruminationDown', { pct: e.ruminationDropPct })} variant="warning" />}
                </View>
                <AppText variant="caption" color={colors.onSurfaceVariant}>
                  {e.weightSource === 'recorded' ? t('ii.weightRecorded', { kg: Math.round(e.weightKg) }) : t('ii.weightBreed', { kg: Math.round(e.weightKg) })}
                </AppText>
              </Pressable>
            ))}
          </>
        )}
      </Screen>
    </View>
  );
}
