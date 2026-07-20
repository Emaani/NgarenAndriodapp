import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { animals as animalsFallback, devices as devicesFallback } from '@/data/mock';
import { getAnimals, getDevices } from '@/data/api';
import { getBreedingRecords, getHealthRecords } from '@/data/clinical';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { exportCsv } from '@/lib/export';
import {
  REPORT_CATALOG,
  ReportKind,
  animalsCsv,
  breedingCsv,
  devicesCsv,
  healthCsv,
} from '@/data/reports';
import { AppText, GradientHeader, Icon, IconChip, Screen } from '@/ui';

/**
 * Reports (Admin + Vet) — export the herd's core datasets as CSV via the system
 * share sheet (save to Files, email, Drive, WhatsApp). Mirrors the web
 * ReportsPage export surface; the CSVs are built from live/mock data.
 */
export default function Reports() {
  const { loading, isAuthenticated, isAdmin, canVet } = useAuth();
  const { data: animals } = useResource(() => getAnimals(), animalsFallback);
  const { data: devices } = useResource(() => getDevices(), devicesFallback);
  const { data: health } = useResource(getHealthRecords, []);
  const { data: breeding } = useResource(getBreedingRecords, []);
  const [busy, setBusy] = useState<ReportKind | null>(null);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin && !canVet) return <Redirect href="/(tabs)/home" />;

  const rowCount = (id: ReportKind) =>
    id === 'livestock' ? animals.length : id === 'devices' ? devices.length : id === 'health' ? health.length : breeding.length;

  const runExport = async (id: ReportKind) => {
    setBusy(id);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const map: Record<ReportKind, { file: string; csv: string }> = {
        livestock: { file: `livestock-${stamp}.csv`, csv: animalsCsv(animals) },
        devices: { file: `devices-${stamp}.csv`, csv: devicesCsv(devices) },
        health: { file: `health-${stamp}.csv`, csv: healthCsv(health) },
        breeding: { file: `breeding-${stamp}.csv`, csv: breedingCsv(breeding) },
      };
      const { file, csv } = map[id];
      const ok = await exportCsv(file, csv);
      if (!ok) {
        Alert.alert('Export unavailable', 'Sharing is not available on this device.');
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Reports" subtitle="Export herd data as CSV" showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <AppText variant="body" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
          Generate a report and choose where to send it — save to Files, email, or share to Drive.
        </AppText>

        {REPORT_CATALOG.map((r) => {
          const count = rowCount(r.id);
          const exporting = busy === r.id;
          return (
            <Pressable
              key={r.id}
              disabled={busy !== null || count === 0}
              onPress={() => runExport(r.id)}
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
                  {count} {count === 1 ? 'row' : 'rows'}
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
          Reports reflect the data currently visible to your role. PDF export is coming with the
          reporting backend.
        </AppText>
      </Screen>
    </View>
  );
}
