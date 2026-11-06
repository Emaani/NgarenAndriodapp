import { useMemo } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { getLiveFeed } from '@/data/liveTracking';
import { useResource } from '@/data/hooks';
import { isSupabaseConfigured } from '@/config';
import { LIVE_WINDOW_MINS, animalLabel, feedSummary, minutesAgo } from '@/lib/liveFixes';
import { formatDateTime } from '@/lib/date';
import { useAuth } from '@/services/auth';
import { useT } from '@/i18n';
import { AppText, EmptyState, GradientHeader, Icon, IconName, Screen } from '@/ui';

const KIND_ICON: Record<ReturnType<typeof feedSummary>['kind'], IconName> = {
  position: 'crosshairs-gps',
  activity: 'run',
  alert: 'alert-decagram-outline',
  summary: 'chart-bar',
  other: 'satellite-variant',
};

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={[{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md }, shadow[1]]}>
      <AppText variant="title">{value}</AppText>
      <AppText variant="caption" color={colors.onSurfaceVariant}>{label}</AppText>
    </View>
  );
}

/**
 * Live satellite telemetry — the newest CERES records for the herd (or one
 * animal), straight from `ceres_telemetry` as on the web: positions, activity,
 * alerts and daily summaries, each with what it reported.
 */
export default function LiveTelemetry() {
  const t = useT();
  const { animal } = useLocalSearchParams<{ animal?: string }>();
  const animalId = animal ? Number(animal) : undefined;
  const { loading, isAuthenticated } = useAuth();
  const { data: feed, loading: busy, reload } = useResource(() => getLiveFeed(animalId), { lineage: [], rows: [], tagsTracked: 0 });

  const byTag = useMemo(() => new Map(feed.lineage.map((l) => [l.animal_tag_id?.trim() ?? '', l])), [feed.lineage]);
  const reporting = useMemo(() => {
    const live = new Set(feed.rows.filter((r) => minutesAgo(r.recorded_at) <= LIVE_WINDOW_MINS).map((r) => r.animal_tag_id));
    return live.size;
  }, [feed.rows]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const single = animalId !== undefined ? feed.lineage[0] : undefined;
  const latest = feed.rows[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('lt.title')} subtitle={single ? animalLabel(single) : t('lt.subtitle')} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }} refreshing={busy} onRefresh={reload}>
        {!isSupabaseConfigured() ? (
          <EmptyState icon="satellite-variant" title={t('lt.demoTitle')} subtitle={t('lt.demoSub')} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              <Stat value={String(feed.tagsTracked)} label={t('lt.tags')} />
              <Stat value={String(reporting)} label={t('lt.reporting')} />
              <Stat value={latest ? t('lt.minsAgo', { mins: minutesAgo(latest.recorded_at) }) : '—'} label={t('lt.lastRecord')} />
            </View>
            {feed.rows.length === 0 ? (
              <EmptyState
                icon="satellite-variant"
                title={t('lt.emptyTitle')}
                subtitle={feed.tagsTracked === 0 ? t('lt.emptyNoTags') : t('lt.emptyNoData')}
              />
            ) : (
              feed.rows.map((r, i) => {
                const s = feedSummary(r);
                const l = byTag.get(r.animal_tag_id);
                return (
                  <View
                    key={`${r.animal_tag_id}-${r.recorded_at}-${i}`}
                    style={[{ flexDirection: 'row', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm }, shadow[1]]}>
                    <Icon name={KIND_ICON[s.kind]} size={20} color={s.kind === 'alert' ? colors.error : colors.primary} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                        <AppText variant="bodyLarge" style={{ fontWeight: '600', flexShrink: 1 }}>{l ? animalLabel(l) : r.animal_tag_id}</AppText>
                        <AppText variant="caption" color={colors.onSurfaceVariant}>{t(`lt.kind.${s.kind}`)}</AppText>
                      </View>
                      <AppText variant="caption" color={colors.onSurfaceVariant}>{formatDateTime(r.recorded_at)}</AppText>
                      {s.parts.length > 0 && <AppText variant="body">{s.parts.join(' · ')}</AppText>}
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </Screen>
    </View>
  );
}
