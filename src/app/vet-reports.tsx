import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { calloutRequests as calloutFallback } from '@/data/mock';
import { getCalloutRequests } from '@/data/api';
import { getMyVetImpact } from '@/data/vetProfiles';
import { vetAuditCsv } from '@/data/reports';
import { observationsCsv, rowsCsv, servicesSummaryCsv, visitsLogCsv } from '@/data/vetReports';
import { getReportAudit, logReportExport, ReportAuditEntry } from '@/data/reportAudit';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { exportCsv } from '@/lib/export';
import { notify } from '@/lib/toast';
import { formatDateTime } from '@/lib/date';
import { VetImpact } from '@/data/types';
import { AppText, GradientHeader, Icon, IconChip, IconName, Screen } from '@/ui';

const EMPTY_IMPACT: VetImpact = {
  totalVisits: 0,
  animalsManaged: 0,
  farmersServiced: 0,
  services: { treatment: 0, vaccination: 0, stockTaking: 0, others: 0 },
  observations: { ticks: 0, flies: 0, disease: 0 },
};

export default function VetReports() {
  const router = useRouter();
  const { loading, isAuthenticated, canVet, user } = useAuth();
  const { data: impact } = useResource(getMyVetImpact, EMPTY_IMPACT);
  const { data: callouts } = useResource(() => getCalloutRequests(), calloutFallback);
  const { data: audit, reload: reloadAudit } = useResource(getReportAudit, []);
  const [busy, setBusy] = useState<string | null>(null);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!canVet) return <Redirect href="/(tabs)/home" />;

  const reports: { id: string; name: string; description: string; icon: IconName; rows: number; csv: () => string }[] = [
    { id: 'visits', name: 'Visits log', description: 'Every call-out — animal, farmer, priority, status.', icon: 'clipboard-pulse-outline', rows: callouts.length, csv: () => visitsLogCsv(callouts) },
    { id: 'audit', name: 'Visits audit (fulfilled vs unfulfilled)', description: 'Service-delivery audit trail across requests.', icon: 'clipboard-check-outline', rows: callouts.length, csv: () => vetAuditCsv(callouts) },
    { id: 'animals', name: 'Animals managed', description: 'Distinct animals treated with record counts.', icon: 'cow', rows: impact.detail?.animals.length ?? impact.animalsManaged, csv: () => rowsCsv(['Animal', 'Records'], impact.detail?.animals ?? []) },
    { id: 'farmers', name: 'Farmers serviced', description: 'Farmers served with visit counts.', icon: 'account-group-outline', rows: impact.detail?.farmers.length ?? impact.farmersServiced, csv: () => rowsCsv(['Farmer', 'Visits'], impact.detail?.farmers ?? []) },
    { id: 'services', name: 'Services summary', description: 'Treatment / vaccination / stock-take / others.', icon: 'medical-bag', rows: 4, csv: () => servicesSummaryCsv(impact) },
    { id: 'observations', name: 'Disease & pest observations', description: 'Ticks / flies / disease trend counts.', icon: 'bug-outline', rows: 3, csv: () => observationsCsv(impact) },
  ];

  const runExport = async (r: (typeof reports)[number]) => {
    setBusy(r.id);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const ok = await exportCsv(`vet-${r.id}-${stamp}.csv`, r.csv());
      await logReportExport({
        report: r.name,
        rows: r.rows,
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
          onPress={() => router.push('/(tabs)/animals')}
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
              Open an animal to generate its full record — the source of truth.
            </AppText>
          </View>
          <Icon name="chevron-right" size={22} color="#fff" />
        </Pressable>

        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          Practice reports
        </AppText>
        {reports.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => runExport(r)}
            disabled={busy !== null}
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.divider, opacity: pressed ? 0.9 : 1 },
              shadow[1],
            ]}>
            <IconChip icon={r.icon} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                {r.name}
              </AppText>
              <AppText variant="caption" color={colors.onSurfaceVariant}>
                {r.description} · {r.rows} row{r.rows === 1 ? '' : 's'}
              </AppText>
            </View>
            <Icon name={busy === r.id ? 'progress-clock' : 'share-variant-outline'} size={20} color={colors.primary} />
          </Pressable>
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
