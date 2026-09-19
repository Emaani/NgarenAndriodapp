import { useMemo } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { loadScorecards, ScorecardStatus, STATUS_LABEL } from '@/data/scorecards';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { statusVisual } from '@/lib/scorecardVisual';
import { formatDate } from '@/lib/date';
import { AppText, EmptyState, GradientHeader, Icon, Screen } from '@/ui';

function Bar({ label, value, total, tint }: { label: string; value: number; total: number; tint: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={{ gap: 4, marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="body" color={colors.onSurface}>
          {label}
        </AppText>
        <AppText variant="body" style={{ fontWeight: '700' }}>
          {value} · {pct}%
        </AppText>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.background, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: tint }} />
      </View>
    </View>
  );
}

/**
 * Disease surveillance (recommended follow-up to scorecard sync): an admin-only,
 * ANONYMIZED aggregate of the diagnosis signals captured across Visit Scorecards
 * — for the Ministry / disease-surveillance use case. It shows leading
 * conditions, the health-status split, and geographic spread by farm/location.
 * No farmer identities are shown. Reads local ∪ remote (RLS-scoped) scorecards.
 */
export default function Surveillance() {
  const { loading, isAuthenticated, isAdmin } = useAuth();
  const { data: cards } = useResource(loadScorecards, []);

  const agg = useMemo(() => {
    const conditions = new Map<string, number>();
    const locations = new Map<string, number>();
    const status: Record<ScorecardStatus, number> = { healthy: 0, monitor: 0, urgent: 0 };
    let earliest = '';
    let latest = '';
    for (const c of cards) {
      status[c.status] = (status[c.status] ?? 0) + 1;
      for (const t of c.diagnosisTags) conditions.set(t, (conditions.get(t) ?? 0) + 1);
      const loc = (c.farmName ?? '').trim() || 'Unspecified';
      locations.set(loc, (locations.get(loc) ?? 0) + 1);
      if (c.date) {
        if (!earliest || c.date < earliest) earliest = c.date;
        if (!latest || c.date > latest) latest = c.date;
      }
    }
    const sort = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
    return {
      total: cards.length,
      status,
      conditions: sort(conditions),
      locations: sort(locations),
      flagged: status.urgent + status.monitor,
      earliest,
      latest,
    };
  }, [cards]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/(tabs)/home" />;

  const maxCondition = agg.conditions[0]?.[1] ?? 1;
  const maxLocation = agg.locations[0]?.[1] ?? 1;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Disease surveillance" subtitle="Anonymized signals across visit scorecards" showBack />
      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        {agg.total === 0 ? (
          <EmptyState icon="chart-box-outline" title="No scorecard data yet" subtitle="Aggregated diagnosis signals will appear here once vets record visit scorecards." />
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md }}>
              <Icon name="shield-lock-outline" size={14} color={colors.onSurfaceVariant} />
              <AppText variant="caption" color={colors.onSurfaceVariant} style={{ flex: 1 }}>
                Aggregated & anonymized — no individual farmers or persons are shown.
              </AppText>
            </View>

            {/* Headline tiles */}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.divider }}>
                <AppText variant="headline" style={{ fontWeight: '800' }}>{agg.total}</AppText>
                <AppText variant="caption" color={colors.onSurfaceVariant}>Scorecards</AppText>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.divider }}>
                <AppText variant="headline" style={{ fontWeight: '800' }} color={colors.error}>{agg.status.urgent}</AppText>
                <AppText variant="caption" color={colors.onSurfaceVariant}>Urgent</AppText>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.divider }}>
                <AppText variant="headline" style={{ fontWeight: '800' }} color={colors.warning}>{agg.status.monitor}</AppText>
                <AppText variant="caption" color={colors.onSurfaceVariant}>Monitor</AppText>
              </View>
            </View>

            {agg.earliest ? (
              <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.lg }}>
                Reporting period: {formatDate(agg.earliest)} – {formatDate(agg.latest)}
              </AppText>
            ) : null}

            {/* Status split */}
            <AppText variant="title" style={{ marginBottom: spacing.sm }}>Health status split</AppText>
            <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
              {(['urgent', 'monitor', 'healthy'] as ScorecardStatus[]).map((s) => (
                <Bar key={s} label={STATUS_LABEL[s]} value={agg.status[s]} total={agg.total} tint={statusVisual(s).color} />
              ))}
            </View>

            {/* Leading conditions */}
            <AppText variant="title" style={{ marginBottom: spacing.sm }}>Leading conditions</AppText>
            <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
              {agg.conditions.length === 0 ? (
                <AppText variant="body" color={colors.onSurfaceVariant}>No diagnoses recorded yet.</AppText>
              ) : (
                agg.conditions.slice(0, 10).map(([tag, n]) => <Bar key={tag} label={tag} value={n} total={maxCondition} tint={colors.primary} />)
              )}
            </View>

            {/* Geographic spread */}
            <AppText variant="title" style={{ marginBottom: spacing.sm }}>By farm / location</AppText>
            <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
              {agg.locations.slice(0, 10).map(([loc, n]) => <Bar key={loc} label={loc} value={n} total={maxLocation} tint={colors.info} />)}
            </View>
          </>
        )}
      </Screen>
    </View>
  );
}
