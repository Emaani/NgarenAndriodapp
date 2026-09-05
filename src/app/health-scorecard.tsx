import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { animals as animalsFallback } from '@/data/mock';
import { getHerd } from '@/data/herd';
import { getLocalHealthRecords, HEALTH_TYPE_LABELS } from '@/data/localHealth';
import { getVetVisits } from '@/data/vetVisits';
import { getCeresBehaviour } from '@/data/ceresBehaviour';
import { healthScoreCardSummary, healthScoreCardText } from '@/data/vetReports';
import { logReportExport } from '@/data/reportAudit';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { exportText } from '@/lib/export';
import { notify } from '@/lib/toast';
import { ageFromDate, formatDate } from '@/lib/date';
import { Animal } from '@/data/types';
import { AppText, Button, DetailRow, EmptyState, GradientHeader, Icon, IconChip, IconName, Screen, SearchBar } from '@/ui';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <AppText variant="title" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
        {title}
      </AppText>
      <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>{children}</View>
    </>
  );
}

function Stat({ value, label, tint }: { value: number; label: string; tint: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: '30%', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.divider }}>
      <AppText variant="title" style={{ fontWeight: '800' }} color={tint}>
        {value}
      </AppText>
      <AppText variant="caption" color={colors.onSurfaceVariant}>
        {label}
      </AppText>
    </View>
  );
}

/**
 * Animal Health Score Card — the source of truth for one animal's data. Compiles
 * identity, devices, full health history, vet visits and telemetry into one view
 * a vet can generate & share; each generation is written to the report audit
 * trail. Reached with ?id=<numeric> or ?key=<tag/AAN/account>&label=<name>, or
 * with no params — in which case it shows an animal picker (so it works from the
 * Reports hub for vets, who don't have the farmer tabs).
 */
export default function HealthScoreCard() {
  const { id, key } = useLocalSearchParams<{ id?: string; key?: string; label?: string }>();
  const { loading, isAuthenticated, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hasTelemetry, setHasTelemetry] = useState(false);

  const { data: herd } = useResource(getHerd, animalsFallback);
  const { data: allHealth } = useResource(getLocalHealthRecords, []);
  const { data: allVisits } = useResource(getVetVisits, []);

  // Resolve the animal from a route param or an in-screen selection.
  const animal: Animal | undefined = useMemo(() => {
    if (id) return herd.find((a) => a.id === Number(id));
    if (key) {
      const k = key.toLowerCase();
      return herd.find((a) => [a.ngarenCode, a.tag, a.accountNumber, a.name].filter(Boolean).map((x) => String(x).toLowerCase()).includes(k));
    }
    if (selectedId != null) return herd.find((a) => a.id === selectedId);
    return undefined;
  }, [herd, id, key, selectedId]);

  // Telemetry status for the resolved animal.
  useEffect(() => {
    let active = true;
    if (!animal) {
      setHasTelemetry(false);
      return;
    }
    const keys = [animal.deviceSerial ?? undefined, animal.tag, animal.ngarenCode].filter((s): s is string => !!s);
    getCeresBehaviour(keys)
      .then((series) => active && setHasTelemetry(series.some((s) => s.actual.length > 0 || s.pfi.length > 0)))
      .catch(() => active && setHasTelemetry(false));
    return () => {
      active = false;
    };
  }, [animal]);

  const health = useMemo(() => {
    if (!animal) return [];
    const keys = [animal.ngarenCode, animal.tag, animal.accountNumber].filter(Boolean).map((x) => String(x));
    return allHealth.filter((r) => keys.includes(r.animalKey) || (animal.name && r.animalLabel === animal.name));
  }, [animal, allHealth]);

  const visits = useMemo(() => {
    if (!animal) return [];
    const needles = [animal.name, animal.tag, animal.accountNumber].filter(Boolean).map((x) => String(x).toLowerCase());
    return allVisits.filter((v) => needles.some((n) => v.animal.toLowerCase().includes(n)));
  }, [animal, allVisits]);

  const summary = useMemo(() => healthScoreCardSummary(health), [health]);

  const pickerList = useMemo(() => {
    const q = query.toLowerCase();
    return herd.filter(
      (a) =>
        (a.accountNumber ?? '').toLowerCase().includes(q) ||
        a.tag.toLowerCase().includes(q) ||
        (a.name ?? '').toLowerCase().includes(q) ||
        a.breed.name.toLowerCase().includes(q),
    );
  }, [herd, query]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  // No animal chosen yet → animal picker (self-contained, works for vets).
  if (!animal) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title="Health Score Card" subtitle="Choose an animal" showBack />
        <View style={{ padding: spacing.md, paddingBottom: 0 }}>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search by account #, tag, name or breed..." />
        </View>
        <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
          {pickerList.length === 0 ? (
            <EmptyState icon="cow" title="No animals" subtitle="Register an animal first to generate its Health Score Card." />
          ) : (
            pickerList.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => setSelectedId(a.id)}
                style={({ pressed }) => [
                  { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.divider, opacity: pressed ? 0.9 : 1 },
                  shadow[1],
                ]}>
                <IconChip icon="cow" />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                    {a.name ?? a.tag}
                  </AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    {a.accountNumber ? `${a.accountNumber} · ` : ''}
                    {a.breed.name} · {a.locationName ?? '—'}
                  </AppText>
                </View>
                <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
              </Pressable>
            ))
          )}
        </Screen>
      </View>
    );
  }

  const onGenerate = async () => {
    setBusy(true);
    const text = healthScoreCardText({
      animal,
      health,
      visits,
      generatedBy: user?.fullName ?? user?.email ?? 'Vet',
      telemetrySummary: hasTelemetry ? 'Ceres telemetry synced (behaviour & activity series available).' : 'No synced telemetry.',
    });
    const fileBase = (animal.accountNumber ?? animal.ngarenCode ?? animal.tag).replace(/[^A-Za-z0-9._-]/g, '');
    const ok = await exportText(`health-scorecard-${fileBase}.txt`, text);
    await logReportExport({
      report: 'Health Score Card',
      subject: `${animal.accountNumber ?? animal.tag}${animal.name ? ` (${animal.name})` : ''}`,
      rows: health.length + visits.length,
      by: user?.fullName ?? user?.email ?? 'Vet',
      actorId: user?.id,
      shared: ok,
    });
    setBusy(false);
    if (!ok) Alert.alert('Sharing unavailable', 'Could not open the share sheet on this device.');
    else notify('Health Score Card generated & shared');
  };

  const typeTint = (t: string) => (t === 'ailment' ? colors.error : t === 'treatment' ? colors.info : t === 'vaccination' ? colors.success : colors.primary);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Health Score Card" subtitle={animal.accountNumber ?? animal.name ?? animal.tag} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
          The source of truth for this animal’s data — identity, devices, full health history, visits and telemetry.
        </AppText>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs }}>
          <Stat value={summary.total} label="Health records" tint="#2563EB" />
          <Stat value={summary.vaccinations} label="Vaccinations" tint="#16A34A" />
          <Stat value={summary.treatments} label="Treatments" tint="#EF4444" />
          <Stat value={visits.length} label="Vet visits" tint="#9333EA" />
          <Stat value={summary.openFollowUps} label="Open follow-ups" tint="#F59E0B" />
          <Stat value={summary.observations.length} label="Obs. flagged" tint="#0EA5E9" />
        </View>

        <Section title="Identity">
          {animal.accountNumber ? <DetailRow label="Account number" value={animal.accountNumber} /> : null}
          {animal.ngarenCode ? <DetailRow label="Internal ID (AAN)" value={animal.ngarenCode} /> : null}
          <DetailRow label="Farmer reference" value={animal.tag} />
          {animal.name ? <DetailRow label="Name" value={animal.name} /> : null}
          <DetailRow label="Breed" value={animal.breed.name} />
          {animal.color ? <DetailRow label="Colour" value={animal.color} /> : null}
          <DetailRow label="Age" value={ageFromDate(animal.dateOfBirth)} />
          <DetailRow label="Location" value={animal.locationName ?? '—'} />
          {animal.physicalAddress ? <DetailRow label="Address" value={animal.physicalAddress} /> : null}
          <DetailRow label="Dam" value={animal.damTag ?? 'Unknown'} />
          <DetailRow label="Sire" value={animal.sireTag ?? 'Unknown'} />
          <DetailRow label="Telemetry" value={hasTelemetry ? 'Ceres synced' : 'No synced telemetry'} last />
        </Section>

        <AppText variant="title" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
          Health history ({health.length})
        </AppText>
        {health.length === 0 ? (
          <AppText variant="body" color={colors.onSurfaceVariant}>
            No health records yet for this animal.
          </AppText>
        ) : (
          health.map((r) => (
            <View key={r.id} style={[{ flexDirection: 'row', gap: spacing.mdMinus, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
              <View style={{ width: 6, borderRadius: 3, backgroundColor: typeTint(r.type) }} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                    {HEALTH_TYPE_LABELS[r.type]}
                  </AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    {formatDate(r.date)}
                  </AppText>
                </View>
                {r.medication ? <AppText variant="caption" color={colors.onSurfaceVariant}>{r.medication}</AppText> : null}
                {r.diagnosis ? <AppText variant="caption" color={colors.onSurfaceVariant}>Dx: {r.diagnosis}</AppText> : null}
                <AppText variant="body" color={colors.onSurface}>{r.notes}</AppText>
                {r.observations?.length ? <AppText variant="caption" color={colors.info}>Obs: {r.observations.join(', ')}</AppText> : null}
                <AppText variant="caption" color={colors.onSurfaceVariant}>by {r.recordedBy}</AppText>
              </View>
            </View>
          ))
        )}

        <Button label={busy ? 'Generating…' : 'Generate & share Score Card'} icon="file-document-outline" loading={busy} onPress={onGenerate} style={{ marginTop: spacing.lg }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
          <Icon name={'shield-check-outline' as IconName} size={14} color={colors.onSurfaceVariant} />
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            Each generation is recorded in the report audit trail.
          </AppText>
        </View>
      </Screen>
    </View>
  );
}
