import { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { getFarmerPortfolio, FarmerPortfolioItem } from '@/data/portfolio';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { exportCsv, exportPdf, toCsv } from '@/lib/export';
import { formatDate } from '@/lib/date';
import { notify } from '@/lib/toast';
import { useT } from '@/i18n';
import { ActionChip, AppText, Button, EmptyState, GradientHeader, Icon, IconChip, Screen } from '@/ui';

const statusVariant = (s: string) => (s === 'active' ? 'success' : s === 'attention' ? 'warning' : 'neutral');

function farmersReportHtml(rows: FarmerPortfolioItem[], by: string): string {
  const body = rows
    .map(
      (f) => `<tr><td>${f.farmerName}</td><td>${f.farmName ?? '—'}</td><td>${f.location ?? '—'}</td><td style="text-align:right">${f.animals}</td><td style="text-align:right">${f.devices}</td><td style="text-align:right">${f.activeTags}</td><td style="text-align:right">${f.healthScore}</td><td>${f.status}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1b1a14;padding:24px}
    h1{color:#3d99f5;font-size:20px;margin:0 0 4px}
    .muted{color:#666;font-size:12px;margin:0 0 16px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}
    th{background:#f2f2ef;text-transform:uppercase;font-size:10px;letter-spacing:.04em}
  </style></head><body>
    <h1>Ngaren — Farmers Managed</h1>
    <p class="muted">Generated ${formatDate(new Date().toISOString())} · by ${by} · ${rows.length} farmers</p>
    <table><thead><tr><th>Farmer</th><th>Farm</th><th>Location</th><th>Animals</th><th>Devices</th><th>Active tags</th><th>Health</th><th>Status</th></tr></thead>
    <tbody>${body}</tbody></table>
  </body></html>`;
}

/**
 * Farmers Managed (Oct 2026 Q&A) — the list of farmers under the vet, with their
 * details and an option to generate a report as PDF or Excel (CSV). Open to vets
 * and admins.
 */
export default function VetFarmers() {
  const router = useRouter();
  const t = useT();
  const { loading, isAuthenticated, canVet, user } = useAuth();
  const { data: farmers } = useResource(getFarmerPortfolio, []);
  const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!canVet) return <Redirect href="/(tabs)/home" />;

  const by = user?.fullName ?? user?.email ?? 'Vet';

  const onPdf = async () => {
    setBusy('pdf');
    const ok = await exportPdf(`ngaren-farmers-${Date.now()}.pdf`, farmersReportHtml(farmers, by));
    setBusy(null);
    if (!ok) notify(t('rep.exportFail'));
  };
  const onExcel = async () => {
    setBusy('excel');
    const csv = toCsv(
      [t('vf.farmer'), t('vf.farm'), t('vf.location'), t('vf.animals'), t('vf.devices'), t('vf.activeTags'), t('vf.health'), t('vf.status')],
      farmers.map((f) => [f.farmerName, f.farmName ?? '', f.location ?? '', f.animals, f.devices, f.activeTags, f.healthScore, f.status]),
    );
    const ok = await exportCsv(`ngaren-farmers-${Date.now()}.csv`, csv);
    setBusy(null);
    if (!ok) notify(t('rep.exportFail'));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('vet.report.farmersManaged')} subtitle={t('vf.subtitle', { count: farmers.length })} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {/* Generate report. */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          <Button label={t('rep.pdf')} icon="file-pdf-box" loading={busy === 'pdf'} disabled={!!busy || farmers.length === 0} onPress={onPdf} style={{ flex: 1 }} />
          <Button label={t('rep.excel')} variant="outline" icon="file-excel-box" loading={busy === 'excel'} disabled={!!busy || farmers.length === 0} onPress={onExcel} style={{ flex: 1 }} />
        </View>

        {farmers.length === 0 ? (
          <EmptyState icon="account-multiple-outline" title={t('vf.emptyTitle')} subtitle={t('vf.emptySub')} />
        ) : (
          farmers.map((f) => (
            <View
              key={f.id}
              style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus }}>
                <IconChip icon="account-outline" />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{f.farmerName}</AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>{[f.farmName, f.location].filter(Boolean).join(' · ')}</AppText>
                </View>
                <ActionChip label={t(`vf.status.${f.status}`)} variant={statusVariant(f.status)} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
                <Stat icon="cow" label={t('vf.animals')} value={f.animals} />
                <Stat icon="tag-outline" label={t('vf.devices')} value={f.devices} />
                <Stat icon="access-point" label={t('vf.activeTags')} value={f.activeTags} />
                <Stat icon="heart-pulse" label={t('vf.health')} value={f.healthScore} />
              </View>
              <Button
                label={t('vf.message')}
                variant="outline"
                icon="message-text-outline"
                onPress={() => router.push('/compose-message?to=farmer' as never)}
                style={{ paddingVertical: spacing.sm }}
              />
            </View>
          ))
        )}
      </Screen>
    </View>
  );
}

function Stat({ icon, label, value }: { icon: 'cow' | 'tag-outline' | 'access-point' | 'heart-pulse'; label: string; value: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <Icon name={icon} size={15} color={colors.onSurfaceVariant} />
      <AppText variant="caption" color={colors.onSurfaceVariant}>
        {label}: <AppText variant="caption" style={{ fontWeight: '700' }} color={colors.onSurface}>{value}</AppText>
      </AppText>
    </View>
  );
}
