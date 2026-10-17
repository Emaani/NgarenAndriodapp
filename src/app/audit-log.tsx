import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { getAmendments } from '@/data/localAmendments';
import { getReportAudit } from '@/data/reportAudit';
import { getAuditEvents } from '@/data/localAuditEvents';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { exportPdf } from '@/lib/export';
import { logReportExport } from '@/data/reportAudit';
import { notify } from '@/lib/toast';
import { formatDate, formatDateTime } from '@/lib/date';
import { useT } from '@/i18n';
import { ActionChip, AppText, Button, EmptyState, GradientHeader, IconChip, Screen } from '@/ui';

/** Branded Ngaren audit-log PDF (olive brand header + wordmark). */
function auditLogHtml(rows: { at: string; title: string; detail: string; by: string; statusLabel: string }[], by: string): string {
  const esc = (s: string) => (s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
  const body = rows
    .map((r) => `<tr><td>${formatDateTime(r.at)}</td><td>${esc(r.title)}</td><td>${esc(r.detail)}</td><td>${esc(r.by)}</td><td>${esc(r.statusLabel)}</td></tr>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { margin: 0; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1B1A14; margin: 0; }
    .brand { background: #6D874F; color: #fff; padding: 22px 28px; display: flex; align-items: center; gap: 14px; }
    .mark { width: 34px; height: 34px; border-radius: 9px; background: rgba(255,255,255,.18); display: flex; align-items: center; justify-content: center; font-size: 20px; }
    .word { font-weight: 800; letter-spacing: 3px; font-size: 22px; }
    .tag { font-size: 10px; letter-spacing: 1.5px; opacity: .9; text-transform: uppercase; }
    .content { padding: 24px 28px; }
    h1 { font-size: 18px; margin: 0 0 2px; color: #4A5F2E; }
    .muted { color: #666; font-size: 12px; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border-bottom: 1px solid #e3e0d6; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #EAF0DD; color: #4A5F2E; text-transform: uppercase; font-size: 9px; letter-spacing: .05em; }
    .foot { margin-top: 20px; font-size: 9px; color: #999; border-top: 1px solid #e3e0d6; padding-top: 8px; }
  </style></head><body>
    <div class="brand"><div class="mark">🐄</div><div><div class="word">NGAREN</div><div class="tag">Livestock Traceability &amp; Managed Health</div></div></div>
    <div class="content">
      <h1>Audit Log — History of Changes</h1>
      <p class="muted">Generated ${formatDate(new Date().toISOString())} · by ${esc(by)} · ${rows.length} entries</p>
      <table><thead><tr><th>Date</th><th>Activity</th><th>Detail</th><th>By</th><th>Status</th></tr></thead>
      <tbody>${body}</tbody></table>
      <p class="foot">Ngaren Back-End Admin Support · Immutable audit trail · Confidential</p>
    </div>
  </body></html>`;
}

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
  const { loading, isAuthenticated, isAdmin, user } = useAuth();
  const { data: amendments } = useResource(getAmendments, []);
  const { data: exports } = useResource(getReportAudit, []);
  const { data: events } = useResource(getAuditEvents, []);
  const [exporting, setExporting] = useState(false);

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
    const eventEntries: Entry[] = events.map((e) => ({
      id: e.id,
      at: e.at,
      icon: 'pencil-outline',
      title: e.title,
      detail: e.detail,
      by: e.by,
      status: e.type === 'animal_deleted' ? { label: t('audit.deleted'), variant: 'error' } : undefined,
    }));
    return [...amendEntries, ...exportEntries, ...eventEntries].sort((a, b) => b.at.localeCompare(a.at));
  }, [amendments, exports, events, t]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/(tabs)/home" />;

  const by = user?.fullName ?? user?.email ?? 'Admin';
  const onExportPdf = async () => {
    setExporting(true);
    const html = auditLogHtml(entries.map((e) => ({ at: e.at, title: e.title, detail: e.detail, by: e.by, statusLabel: e.status?.label ?? '' })), by);
    const ok = await exportPdf(`ngaren-audit-log-${Date.now()}.pdf`, html);
    void logReportExport({ report: 'Audit Log (PDF)', rows: entries.length, by, actorId: user?.id, shared: ok });
    setExporting(false);
    if (!ok) notify(t('rep.exportFail'));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('audit.title')} subtitle={t('audit.subtitle', { count: entries.length })} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <Button
          label={t('audit.exportPdf')}
          icon="file-pdf-box"
          loading={exporting}
          disabled={exporting || entries.length === 0}
          onPress={onExportPdf}
          style={{ marginBottom: spacing.md }}
        />
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
