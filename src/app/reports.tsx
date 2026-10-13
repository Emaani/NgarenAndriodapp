import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { animals as animalsFallback, devices as devicesFallback } from '@/data/mock';
import { getDevices, getCalloutRequests } from '@/data/api';
import { getHerd } from '@/data/herd';
import { calloutRequests as calloutFallback } from '@/data/mock';
import { getBreedingRecords, getHealthRecords } from '@/data/clinical';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { exportCsv, exportPdf } from '@/lib/export';
import { logReportExport } from '@/data/reportAudit';
import {
  REPORT_CATALOG,
  ReportKind,
  animalsCsv,
  breedingCsv,
  devicesCsv,
  healthCsv,
  vetAuditCsv,
} from '@/data/reports';
import { useT } from '@/i18n';
import { AppText, GradientHeader, Icon, IconChip, Screen } from '@/ui';

/**
 * Reports (Admin + Vet) — export the herd's core datasets as CSV via the system
 * share sheet (save to Files, email, Drive, WhatsApp). Mirrors the web
 * ReportsPage export surface; the CSVs are built from live/mock data.
 */
export default function Reports() {
  const t = useT();
  const { loading, isAuthenticated, isAdmin, canVet, user } = useAuth();
  const { data: animals } = useResource(getHerd, animalsFallback);
  const { data: devices } = useResource(() => getDevices(), devicesFallback);
  const { data: health } = useResource(getHealthRecords, []);
  const { data: breeding } = useResource(getBreedingRecords, []);
  const { data: callouts } = useResource(() => getCalloutRequests(), calloutFallback);
  const [busy, setBusy] = useState<ReportKind | null>(null);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin && !canVet) return <Redirect href="/(tabs)/home" />;

  const rowCount = (id: ReportKind) =>
    id === 'livestock' ? animals.length
      : id === 'devices' ? devices.length
      : id === 'health' ? health.length
      : id === 'vet_audit' ? callouts.length
      : breeding.length;

  // Parse a CSV string back into a branded HTML table for the PDF export, so
  // every report is available in both Excel (CSV) and PDF (FR-ADM-12).
  const csvToHtml = (title: string, csv: string): string => {
    const rows = csv.split(/\r?\n/).filter((l) => l.length > 0).map((line) => {
      const cells: string[] = [];
      let cur = '', q = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (q) {
          if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (c === '"') q = false;
          else cur += c;
        } else if (c === '"') q = true;
        else if (c === ',') { cells.push(cur); cur = ''; }
        else cur += c;
      }
      cells.push(cur);
      return cells;
    });
    const head = rows[0] ?? [];
    const body = rows.slice(1);
    const esc = (s: string) => s.replace(/</g, '&lt;');
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1b1a14;padding:24px}
      h1{color:#6d874f;font-size:20px;margin:0 0 4px}.muted{color:#666;font-size:12px;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border-bottom:1px solid #ddd;padding:5px 7px;text-align:left;vertical-align:top}
      th{background:#f2f2ef;text-transform:uppercase;font-size:9px;letter-spacing:.04em}
    </style></head><body><h1>Ngaren — ${esc(title)}</h1>
      <p class="muted">Generated ${new Date().toISOString().slice(0, 10)} · ${body.length} rows</p>
      <table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    </body></html>`;
  };

  const runExport = async (id: ReportKind, format: 'csv' | 'pdf') => {
    setBusy(id);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const map: Record<ReportKind, { base: string; title: string; csv: string }> = {
        livestock: { base: `livestock-${stamp}`, title: 'Animals Managed', csv: animalsCsv(animals) },
        devices: { base: `devices-${stamp}`, title: 'Device Manager & Telemetry', csv: devicesCsv(devices) },
        health: { base: `health-${stamp}`, title: 'Animal Health Records', csv: healthCsv(health) },
        vet_audit: { base: `vet-visits-audit-${stamp}`, title: 'Visit Audit', csv: vetAuditCsv(callouts) },
        breeding: { base: `breeding-${stamp}`, title: 'Breeding & Reproduction', csv: breedingCsv(breeding) },
      };
      const { base, title, csv } = map[id];
      const ok = format === 'pdf'
        ? await exportPdf(`${base}.pdf`, csvToHtml(title, csv))
        : await exportCsv(`${base}.csv`, csv);
      // Record the export in the audit trail (FR-ADM-04 / FR-ADM-12).
      void logReportExport({ report: `${title} (${format.toUpperCase()})`, rows: rowCount(id), by: user?.fullName ?? user?.email ?? 'Admin', actorId: user?.id, shared: ok });
      if (!ok) {
        Alert.alert(t('rep.exportFailTitle'), t('rep.exportFailBody'));
      }
    } finally {
      setBusy(null);
    }
  };

  const chooseFormat = (id: ReportKind, name: string) => {
    Alert.alert(name, t('rep.chooseFormat'), [
      { text: t('rep.pdf'), onPress: () => runExport(id, 'pdf') },
      { text: t('rep.excel'), onPress: () => runExport(id, 'csv') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('action.reports')} subtitle={t('rep.subtitle')} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <AppText variant="body" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
          {t('rep.intro')}
        </AppText>

        {REPORT_CATALOG.map((r) => {
          const count = rowCount(r.id);
          const exporting = busy === r.id;
          return (
            <Pressable
              key={r.id}
              disabled={busy !== null || count === 0}
              onPress={() => chooseFormat(r.id, r.name)}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  borderRadius: radius.md,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.divider,
                  opacity: count === 0 ? 0.5 : pressed ? 0.9 : 1,
                },
                shadow[1],
              ]}>
              <IconChip icon={r.icon as never} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                  {r.name}
                </AppText>
                <AppText variant="caption" color={colors.onSurfaceVariant}>
                  {r.description}
                </AppText>
                <AppText variant="caption" color={colors.primary} style={{ fontWeight: '600', marginTop: 2 }}>
                  {count === 1 ? t('rep.rowOne', { count }) : t('rep.rows', { count })}
                </AppText>
              </View>
              <Icon
                name={exporting ? 'progress-download' : 'download'}
                size={22}
                color={count === 0 ? colors.onSurfaceVariant : colors.primary}
              />
            </Pressable>
          );
        })}

        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginTop: spacing.md }}>
          {t('rep.footer')}
        </AppText>
      </Screen>
    </View>
  );
}
