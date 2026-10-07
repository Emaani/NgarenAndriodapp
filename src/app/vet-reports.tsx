import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { calloutRequests as calloutFallback } from '@/data/mock';
import { getCalloutRequests } from '@/data/api';
import { getMyVetImpact } from '@/data/vetProfiles';
import { getReportAudit, logReportExport, ReportAuditEntry } from '@/data/reportAudit';
import { addDocument } from '@/data/documents';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { toCsv } from '@/lib/export';
import { brandedHtml, tableSection } from '@/lib/pdfTemplate';
import { makeFarmerAnonymizer } from '@/lib/anon';
import { notify } from '@/lib/toast';
import { formatDateTime } from '@/lib/date';
import { CalloutRequest, VetImpact } from '@/data/types';
import { useT } from '@/i18n';
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
  const t = useT();
  const { loading, isAuthenticated, canVet, isAdmin, user } = useAuth();
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
        name: t('vr.rVisitsName'),
        description: t('vr.rVisitsDesc'),
        icon: 'clipboard-pulse-outline',
        headers: ['Animal', 'Farmer', 'Location', 'Priority', 'Status', 'Fulfilment', 'Requested'],
        rows: (callouts as CalloutRequest[]).map((c) => [c.animal, alias(c.farmerName), c.locationName, c.urgency, c.status, fulfilment(c.status), c.requestedAt]),
      },
      {
        id: 'audit',
        name: t('vr.rAuditName'),
        description: t('vr.rAuditDesc'),
        icon: 'clipboard-check-outline',
        headers: ['Animal', 'Farmer', 'Location', 'Priority', 'SLA', 'Status', 'Fulfilment', 'Requested', 'Distance (km)'],
        rows: (callouts as CalloutRequest[]).map((r) => [r.animal, alias(r.farmerName), r.locationName, r.urgency, slaFor(r.urgency), r.status, fulfilment(r.status), r.requestedAt, String(r.distanceKm)]),
      },
      {
        id: 'animals',
        name: t('vr.rAnimalsName'),
        description: t('vr.rAnimalsDesc'),
        icon: 'cow',
        headers: ['Animal', 'Records'],
        rows: (impact.detail?.animals ?? []).map((a) => [a.label, a.sub ?? '']),
      },
      {
        id: 'farmers',
        name: t('vr.rFarmersName'),
        description: t('vr.rFarmersDesc'),
        icon: 'account-group-outline',
        headers: ['Farmer', 'Visits'],
        rows: (impact.detail?.farmers ?? []).map((f) => [f.label, f.sub ?? '']),
      },
      {
        id: 'services',
        name: t('vr.rServicesName'),
        description: t('vr.rServicesDesc'),
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
        name: t('vr.rObsName'),
        description: t('vr.rObsDesc'),
        icon: 'bug-outline',
        headers: ['Observation', 'Count'],
        rows: [
          ['Ticks', o.ticks],
          ['Flies', o.flies],
          ['Disease', o.disease],
        ],
      },
    ];
  }, [callouts, impact, t]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!canVet) return <Redirect href="/(tabs)/home" />;

  // Generate a report → store it (branded HTML for PDF, or CSV) and open the
  // preview (Sep 12 2026 documents module). Sharing happens from the preview.
  const runExport = async (r: ReportDef, format: 'pdf' | 'csv') => {
    setBusy(`${r.id}:${format}`);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const content =
        format === 'pdf'
          ? brandedHtml({ title: r.name, subtitle: r.description, body: tableSection(r.name, r.headers, r.rows) })
          : toCsv(r.headers, r.rows);
      const id = await addDocument({
        kind: 'report',
        title: r.name,
        subject: `${r.rows.length} row${r.rows.length === 1 ? '' : 's'}`,
        ownerRole: isAdmin ? 'admin' : 'vet',
        ownerId: user?.id ?? null,
        format,
        filename: `vet-${r.id}-${stamp}.${format}`,
        content,
      });
      await logReportExport({
        report: `${r.name} (${format.toUpperCase()})`,
        rows: r.rows.length,
        by: user?.fullName ?? user?.email ?? 'Vet',
        actorId: user?.id,
        shared: true,
      });
      reloadAudit();
      notify(t('vr.generated', { name: r.name }));
      router.push(`/documents/${id}` as never);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('action.reports')} subtitle={t('vr.subtitle')} showBack />
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
              {t('ad.scorecard')}
            </AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.9)">
              {t('vr.scorecardSub')}
            </AppText>
          </View>
          <Icon name="chevron-right" size={22} color="#fff" />
        </Pressable>

        {/* Classified documents module (Sep 12 2026). */}
        <Pressable
          onPress={() => router.push('/documents' as never)}
          style={({ pressed }) => [
            { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.divider, opacity: pressed ? 0.92 : 1 },
            shadow[1],
          ]}>
          <IconChip icon="folder-multiple-outline" />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>
              {t('home.banner.documents')}
            </AppText>
            <AppText variant="caption" color={colors.onSurfaceVariant}>
              {t('vr.docsSub')}
            </AppText>
          </View>
          <Icon name="chevron-right" size={22} color={colors.onSurfaceVariant} />
        </Pressable>

        <AppText variant="title" style={{ marginBottom: spacing.xs }}>
          {t('vr.practiceReports')}
        </AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          {t('vr.practiceHint')}
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
                  {r.description} · {r.rows.length === 1 ? t('rep.rowOne', { count: r.rows.length }) : t('rep.rows', { count: r.rows.length })}
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
          {t('vr.auditTrail')}
        </AppText>
        {audit.length === 0 ? (
          <AppText variant="body" color={colors.onSurfaceVariant}>
            {t('vr.noAudit')}
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
                  {formatDateTime(e.at)} · {e.by} · {e.rows === 1 ? t('rep.rowOne', { count: e.rows }) : t('rep.rows', { count: e.rows })}
                </AppText>
              </View>
            </View>
          ))
        )}
      </Screen>
    </View>
  );
}
