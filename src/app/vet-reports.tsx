import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { calloutRequests as calloutFallback } from '@/data/mock';
import { getCalloutRequests } from '@/data/api';
import { getMyVetImpact } from '@/data/vetProfiles';
import { getReportAudit, logReportExport, ReportAuditEntry } from '@/data/reportAudit';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { toCsv, exportCsv, exportPdf } from '@/lib/export';
import { brandedHtml, tableSection } from '@/lib/pdfTemplate';
import { makeFarmerAnonymizer } from '@/lib/anon';
import { notify } from '@/lib/toast';
import { formatDateTime } from '@/lib/date';
import { CalloutRequest, VetImpact } from '@/data/types';
import { AppText, GradientHeader, Icon, IconChip, IconName, Screen } from '@/ui';

const EMPTY_IMPACT: VetImpact = {
  totalVisits: 0,
  animalsManaged: 0,
  farmersServiced: 0,
  services: { treatment: 0, vaccination: 0, stockTaking: 0, others: 0 },
  observations: { ticks: 0, flies: 0, disease: 0 },
};

const fulfilment = (s: string) =>
  s === 'completed' ? 'Fulfilled' : s === 'declined' ? 'Unfulfilled' : s === 'accepted' ? 'In progress' : 'Awaiting';

interface ReportDef {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  headers: string[];
  rows: (string | number)[][];
}

export default function VetReports() {
  const router = useRouter();
  const { loading, isAuthenticated, canVet, user } = useAuth();
  const { data: impact } = useResource(getMyVetImpact, EMPTY_IMPACT);
  const { data: callouts } = useResource(() => getCalloutRequests(), calloutFallback);
  const { data: audit, reload: reloadAudit } = useResource(getReportAudit, []);
  const [busy, setBusy] = useState<string | null>(null);

  // Build every practice report as structured data so it can be rendered to
  // either a brand-styled PDF or a CSV/Excel file (Sep 5 2026 standup).
  const reports = useMemo<ReportDef[]>(() => {
    // One anonymizer per build keeps "Farmer #N" consistent across the
    // call-out-based reports (anonymized vet view, Sep 5 2026).
    const alias = makeFarmerAnonymizer();
    const s = impact.services;
    const o = impact.observations;
    const slaFor = (u: string) => (u === 'Emergency' ? '4h' : '48h');
    return [
      {
        id: 'visits',
        name: 'Visits log',
        description: 'Every call-out — animal, farmer, priority, status.',
        icon: 'clipboard-pulse-outline',
        headers: ['Animal', 'Farmer', 'Location', 'Priority', 'Status', 'Fulfilment', 'Requested'],
        rows: (callouts as CalloutRequest[]).map((c) => [c.animal, alias(c.farmerName), c.locationName, c.urgency, c.status, fulfilment(c.status), c.requestedAt]),
      },
      {
        id: 'audit',
        name: 'Visits audit (fulfilled vs unfulfilled)',
        description: 'Service-delivery audit trail across requests.',
        icon: 'clipboard-check-outline',
        headers: ['Animal', 'Farmer', 'Location', 'Priority', 'SLA', 'Status', 'Fulfilment', 'Requested', 'Distance (km)'],
        rows: (callouts as CalloutRequest[]).map((r) => [r.animal, alias(r.farmerName), r.locationName, r.urgency, slaFor(r.urgency), r.status, fulfilment(r.status), r.requestedAt, String(r.distanceKm)]),
      },
      {
        id: 'animals',
        name: 'Animals managed',
        description: 'Distinct animals treated with record counts.',
        icon: 'cow',
        headers: ['Animal', 'Records'],
        rows: (impact.detail?.animals ?? []).map((a) => [a.label, a.sub ?? '']),
      },
      {
        id: 'farmers',
        name: 'Farmers serviced',
        description: 'Farmers served with visit counts (anonymized).',
        icon: 'account-group-outline',
        headers: ['Farmer', 'Visits'],
        rows: (impact.detail?.farmers ?? []).map((f) => [f.label, f.sub ?? '']),
      },
      {
        id: 'services',
        name: 'Services summary',
        description: 'Treatment / vaccination / stock-take / others.',
        icon: 'medical-bag',
        headers: ['Service', 'Count'],
        rows: [
          ['Treatment', s.treatment],
          ['Vaccination', s.vaccination],
          ['Stock-taking', s.stockTaking],
          ['Others', s.others],
          ['TOTAL', s.treatment + s.vaccination + s.stockTaking + s.others],
        ],
      },
      {
        id: 'observations',
        name: 'Disease & pest observations',
        description: 'Ticks / flies / disease trend counts.',
        icon: 'bug-outline',
        headers: ['Observation', 'Count'],
        rows: [
          ['Ticks', o.ticks],
          ['Flies', o.flies],
          ['Disease', o.disease],
        ],
      },
    ];
  }, [callouts, impact]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!canVet) return <Redirect href="/(tabs)/home" />;

  const runExport = async (r: ReportDef, format: 'pdf' | 'csv') => {
    setBusy(`${r.id}:${format}`);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const ok =
        format === 'pdf'
          ? await exportPdf(
              `vet-${r.id}-${stamp}.pdf`,
              brandedHtml({ title: r.name, subtitle: r.description, body: tableSection(r.name, r.headers, r.rows) }),
            )
          : await exportCsv(`vet-${r.id}-${stamp}.csv`, toCsv(r.headers, r.rows));
      await logReportExport({
        report: `${r.name} (${format.toUpperCase()})`,
        rows: r.rows.length,
        by: user?.fullName ?? user?.email ?? 'Vet',
        actorId: user?.id,
        shared: ok,
      });
      reloadAudit();
      if (!ok) Alert.alert('Sharing unavailable', 'Could not open the share sheet on this device.');
      else notify(`${r.name} exported`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Reports" subtitle="Generate & share — with an audit trail" showBack />
      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        {/* Per-animal source of truth */}
        <Pressable
          onPress={() => router.push('/health-scorecard' as never)}
          style={({ pressed }) => [
            { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, opacity: pressed ? 0.92 : 1 },
            shadow[1],
          ]}>
          <View style={{ width: 44, height: 44, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="file-document-outline" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyLarge" color="#fff" style={{ fontWeight: '700' }}>
              Health Score Card
            </AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.9)">
              Pick an animal to generate its full record — branded PDF, the source of truth.
            </AppText>
          </View>
          <Icon name="chevron-right" size={22} color="#fff" />
        </Pressable>

        <AppText variant="title" style={{ marginBottom: spacing.xs }}>
          Practice reports
        </AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          Tap to share a branded PDF, or tap Excel for a spreadsheet (CSV).
        </AppText>
        {reports.map((r) => (
          <View
            key={r.id}
            style={[
              { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.divider },
              shadow[1],
            ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <IconChip icon={r.icon} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                  {r.name}
                </AppText>
                <AppText variant="caption" color={colors.onSurfaceVariant}>
                  {r.description} · {r.rows.length} row{r.rows.length === 1 ? '' : 's'}
                </AppText>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <Pressable
                onPress={() => runExport(r, 'pdf')}
                disabled={busy !== null}
                style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primary, opacity: pressed || busy !== null ? 0.85 : 1 })}>
                <Icon name={busy === `${r.id}:pdf` ? 'progress-clock' : 'file-pdf-box'} size={18} color="#fff" />
                <AppText variant="body" color="#fff" style={{ fontWeight: '700' }}>
                  PDF
                </AppText>
              </Pressable>
              <Pressable
                onPress={() => runExport(r, 'csv')}
                disabled={busy !== null}
                style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, opacity: pressed || busy !== null ? 0.85 : 1 })}>
                <Icon name={busy === `${r.id}:csv` ? 'progress-clock' : 'file-excel-outline'} size={18} color={colors.primary} />
                <AppText variant="body" color={colors.primary} style={{ fontWeight: '700' }}>
                  Excel
                </AppText>
              </Pressable>
            </View>
          </View>
        ))}

        {/* Audit trail */}
        <AppText variant="title" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
          Audit trail
        </AppText>
        {audit.length === 0 ? (
          <AppText variant="body" color={colors.onSurfaceVariant}>
            No reports generated yet. Exports are logged here for accountability.
          </AppText>
        ) : (
          audit.map((e: ReportAuditEntry) => (
            <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
              <Icon name={e.shared ? 'check-circle-outline' : 'alert-circle-outline'} size={16} color={e.shared ? colors.success : colors.warning} />
              <View style={{ flex: 1 }}>
                <AppText variant="body" style={{ fontWeight: '600' }}>
                  {e.report}
                  {e.subject ? ` · ${e.subject}` : ''}
                </AppText>
                <AppText variant="caption" color={colors.onSurfaceVariant}>
                  {formatDateTime(e.at)} · {e.by} · {e.rows} row{e.rows === 1 ? '' : 's'}
                </AppText>
              </View>
            </View>
          ))
        )}
      </Screen>
    </View>
  );
}
