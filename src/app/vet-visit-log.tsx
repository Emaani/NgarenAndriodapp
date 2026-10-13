import { useState } from 'react';
import { Image, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { getVetVisits, VetVisit, OUTCOME_LABELS } from '@/data/vetVisits';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { exportCsv, exportPdf, toCsv } from '@/lib/export';
import { formatDate, formatDateTime } from '@/lib/date';
import { notify } from '@/lib/toast';
import { useT } from '@/i18n';
import { ActionChip, AppText, Button, EmptyState, GradientHeader, IconChip, Screen } from '@/ui';

const outcomeVariant = (o: string) => (o === 'healthy' ? 'success' : o === 'treated' ? 'info' : 'warning');

function visitsReportHtml(rows: VetVisit[], by: string): string {
  const body = rows
    .map(
      (v) => `<tr><td>${formatDateTime(v.loggedAt)}</td><td>${v.animal}</td><td>${OUTCOME_LABELS[v.outcome] ?? v.outcome}</td><td>${(v.findings ?? '').replace(/</g, '&lt;')}</td><td>${v.vetName}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1b1a14;padding:24px}
    h1{color:#3d99f5;font-size:20px;margin:0 0 4px}
    .muted{color:#666;font-size:12px;margin:0 0 16px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}
    th{background:#f2f2ef;text-transform:uppercase;font-size:10px;letter-spacing:.04em}
  </style></head><body>
    <h1>Ngaren — Visit Log</h1>
    <p class="muted">Generated ${formatDate(new Date().toISOString())} · by ${by} · ${rows.length} visits</p>
    <table><thead><tr><th>Date</th><th>Animal</th><th>Outcome</th><th>Findings</th><th>Vet</th></tr></thead>
    <tbody>${body}</tbody></table>
  </body></html>`;
}

/**
 * Visit Log (Oct 2026 Q&A) — every field visit the vet has logged, with an
 * option to export the log as PDF or Excel (CSV). Open to vets and admins.
 */
export default function VetVisitLog() {
  const t = useT();
  const { loading, isAuthenticated, canVet, user } = useAuth();
  const { data: visits } = useResource(getVetVisits, []);
  const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!canVet) return <Redirect href="/(tabs)/home" />;

  const by = user?.fullName ?? user?.email ?? 'Vet';

  const onPdf = async () => {
    setBusy('pdf');
    const ok = await exportPdf(`ngaren-visit-log-${Date.now()}.pdf`, visitsReportHtml(visits, by));
    setBusy(null);
    if (!ok) notify(t('rep.exportFail'));
  };
  const onExcel = async () => {
    setBusy('excel');
    const csv = toCsv(
      [t('vl.date'), t('vl.animal'), t('vl.outcome'), t('vl.findings'), t('vl.vet')],
      visits.map((v) => [formatDateTime(v.loggedAt), v.animal, OUTCOME_LABELS[v.outcome] ?? v.outcome, v.findings, v.vetName]),
    );
    const ok = await exportCsv(`ngaren-visit-log-${Date.now()}.csv`, csv);
    setBusy(null);
    if (!ok) notify(t('rep.exportFail'));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('vet.report.visitLog')} subtitle={t('vl.subtitle', { count: visits.length })} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          <Button label={t('rep.pdf')} icon="file-pdf-box" loading={busy === 'pdf'} disabled={!!busy || visits.length === 0} onPress={onPdf} style={{ flex: 1 }} />
          <Button label={t('rep.excel')} variant="outline" icon="file-excel-box" loading={busy === 'excel'} disabled={!!busy || visits.length === 0} onPress={onExcel} style={{ flex: 1 }} />
        </View>

        {visits.length === 0 ? (
          <EmptyState icon="clipboard-text-outline" title={t('vl.emptyTitle')} subtitle={t('vl.emptySub')} />
        ) : (
          visits.map((v) => (
            <View
              key={v.id}
              style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus }}>
                {v.photo ? (
                  <Image source={{ uri: v.photo }} style={{ width: 44, height: 44, borderRadius: radius.md }} />
                ) : (
                  <IconChip icon="clipboard-check-outline" />
                )}
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{v.animal}</AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>{formatDateTime(v.loggedAt)} · {v.vetName}</AppText>
                </View>
                <ActionChip label={OUTCOME_LABELS[v.outcome] ?? v.outcome} variant={outcomeVariant(v.outcome)} />
              </View>
              {!!v.findings && <AppText variant="body" color={colors.onSurface}>{v.findings}</AppText>}
            </View>
          ))
        )}
      </Screen>
    </View>
  );
}
