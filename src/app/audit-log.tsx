import { useMemo } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { getAmendments } from '@/data/localAmendments';
import { getReportAudit } from '@/data/reportAudit';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { formatDateTime } from '@/lib/date';
import { useT } from '@/i18n';
import { ActionChip, AppText, EmptyState, GradientHeader, IconChip, Screen } from '@/ui';

type Entry = {
  id: string;
  at: string;
  icon: 'pencil-outline' | 'file-chart-outline';
  title: string;
  detail: string;
  by: string;
  status?: { label: string; variant: 'success' | 'warning' | 'error' | 'neutral' | 'info' };
};

/**
 * Audit Log — "History of Changes" (FR-ADM-04). A chronological, admin-visible
 * feed of record amendments (who changed what, and the approval outcome) and
 * report exports (who generated which report). Read-only; the underlying records
 * are immutable. In sync with the Approvals and Reports workstreams.
 */
export default function AuditLog() {
  const t = useT();
  const { loading, isAuthenticated, isAdmin } = useAuth();
  const { data: amendments } = useResource(getAmendments, []);
  const { data: exports } = useResource(getReportAudit, []);

  const entries: Entry[] = useMemo(() => {
    const amendEntries: Entry[] = amendments.map((a) => ({
      id: `am-${a.id}`,
      at: a.proposedAt,
      icon: 'pencil-outline',
      title: t('audit.amended', { label: a.animalLabel }),
      detail: `${a.animalKey} · ${a.changes.map((c) => c.label).join(', ')}`,
      by: a.proposedBy,
      status:
        a.status === 'approved'
          ? { label: t('audit.approved'), variant: 'success' }
          : a.status === 'rejected'
            ? { label: t('audit.rejected'), variant: 'error' }
            : { label: t('audit.pending'), variant: 'warning' },
    }));
    const exportEntries: Entry[] = exports.map((e) => ({
      id: `ex-${e.id}`,
      at: e.at,
      icon: 'file-chart-outline',
      title: t('audit.exported', { report: e.report }),
      detail: `${e.subject ? `${e.subject} · ` : ''}${t('audit.rows', { count: e.rows })}`,
      by: e.by,
      status: { label: t('audit.export'), variant: 'info' },
    }));
    return [...amendEntries, ...exportEntries].sort((a, b) => b.at.localeCompare(a.at));
  }, [amendments, exports, t]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/(tabs)/home" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('audit.title')} subtitle={t('audit.subtitle', { count: entries.length })} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {entries.length === 0 ? (
          <EmptyState icon="history" title={t('audit.emptyTitle')} subtitle={t('audit.emptySub')} />
        ) : (
          entries.map((e) => (
            <View
              key={e.id}
              style={[{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.mdMinus, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
              <IconChip icon={e.icon} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{e.title}</AppText>
                <AppText variant="caption" color={colors.onSurfaceVariant}>{e.detail}</AppText>
                <AppText variant="caption" color={colors.onSurfaceVariant}>{t('audit.by', { name: e.by })} · {formatDateTime(e.at)}</AppText>
              </View>
              {e.status ? <ActionChip label={e.status.label} variant={e.status.variant} /> : null}
            </View>
          ))
        )}
      </Screen>
    </View>
  );
}
