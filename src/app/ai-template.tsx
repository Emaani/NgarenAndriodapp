import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { animals as animalsFallback } from '@/data/mock';
import { getHerd } from '@/data/herd';
import { addAiRecord } from '@/data/aiRecords';
import { addCatalogType, CatalogKind, getCatalogNames } from '@/data/clinicalCatalog';
import { logAuditEvent } from '@/data/localAuditEvents';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { notify } from '@/lib/toast';
import { Animal } from '@/data/types';
import { useT } from '@/i18n';
import { AppText, Button, DatePickerField, GradientHeader, Icon, Screen, SearchBar, TextField } from '@/ui';

/** Inline searchable catalog picker with inline capture (drug / sire breed). */
function CatalogChips({ kind, value, onPick, placeholder, onReload }: { kind: CatalogKind; value: string; onPick: (v: string) => void; placeholder: string; onReload: (names: string[]) => void }) {
  const [options, setOptions] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void getCatalogNames(kind).then(setOptions);
  }, [kind]);

  const q = query.trim().toLowerCase();
  const matches = options.filter((o) => !q || o.toLowerCase().includes(q));
  const exact = options.some((o) => o.toLowerCase() === q);

  const add = async (name: string) => {
    await addCatalogType(kind, name);
    const next = await getCatalogNames(kind);
    setOptions(next);
    onReload(next);
    onPick(name);
    setQuery('');
  };

  return (
    <>
      <SearchBar value={query} onChangeText={setQuery} placeholder={placeholder} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }}>
        {matches.slice(0, 14).map((o) => {
          const on = value.toLowerCase() === o.toLowerCase();
          return (
            <Pressable key={o} onPress={() => onPick(o)} style={{ paddingHorizontal: spacing.mdMinus, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.divider }}>
              <AppText variant="caption" color={on ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>{o}</AppText>
            </Pressable>
          );
        })}
        {query.trim() && !exact ? (
          <Pressable onPress={() => void add(query.trim())} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.mdMinus, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.primaryTint, borderWidth: 1, borderColor: colors.primary }}>
            <Icon name="plus" size={14} color={colors.primary} />
            <AppText variant="caption" color={colors.primary} style={{ fontWeight: '700' }}>{`Add “${query.trim()}”`}</AppText>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

/**
 * Artificial Insemination template (Oct 20 2026 vet spec). The vet completes an
 * AI record per AAN: date of preparation, medication applied, the scheduled
 * return date, the sire breed applied (add a new one if missing), and the semen
 * source. Reached with ?key=<animal>&label=<name>&callout=<id>.
 */
export default function AiTemplate() {
  const router = useRouter();
  const t = useT();
  const { key, label, callout } = useLocalSearchParams<{ key?: string; label?: string; callout?: string }>();
  const { loading, isAuthenticated, canVet, user } = useAuth();
  const { data: herd } = useResource(getHerd, animalsFallback);

  const animal: Animal | undefined = useMemo(() => {
    if (!key) return undefined;
    const k = key.toLowerCase();
    return herd.find((a) => [a.ngarenCode, a.tag, a.accountNumber, a.name].filter(Boolean).map((x) => String(x).toLowerCase()).includes(k));
  }, [herd, key]);

  const animalLabel = label ?? animal?.name ?? animal?.tag ?? key ?? 'Animal';
  const animalKey = animal?.ngarenCode ?? animal?.tag ?? key ?? animalLabel;

  const [preparedDate, setPreparedDate] = useState(new Date().toISOString().slice(0, 10));
  const [medication, setMedication] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [sireBreed, setSireBreed] = useState('');
  const [semenSource, setSemenSource] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!canVet) return <Redirect href="/(tabs)/home" />;

  const canSave = !!preparedDate && !!sireBreed.trim();

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const vetName = user?.fullName ?? user?.email ?? 'Vet';
      await addAiRecord({
        aan: animalKey,
        animalLabel,
        farmerId: animal?.farmerId ?? null,
        preparedDate,
        medication: medication.trim() || null,
        scheduledDate: scheduledDate || null,
        sireBreed: sireBreed.trim() || null,
        semenSource: semenSource.trim() || null,
        notes: notes.trim() || null,
        vetName,
        vetId: user?.id ?? null,
      });
      void logAuditEvent({ type: 'other', title: `AI record saved — ${animalLabel}`, detail: `${animalKey} · ${sireBreed}${semenSource ? ` · ${semenSource}` : ''}`, by: vetName });
      notify('AI record saved');
      if (callout) router.back();
      else router.replace('/(tabs)/home');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Artificial Insemination" subtitle={animalLabel} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
          <View style={{ width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="dna" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>{animalLabel}</AppText>
            <AppText variant="caption" color={colors.onSurfaceVariant}>AAN {animalKey}</AppText>
          </View>
        </View>

        <DatePickerField label="Date of preparation" value={preparedDate} placeholder="Pick a date" onSelect={setPreparedDate} />

        <AppText variant="body" style={{ fontWeight: '600', marginTop: spacing.xs, marginBottom: spacing.xs }}>Medication applied</AppText>
        <CatalogChips kind="drug" value={medication} onPick={setMedication} placeholder="Search medication, or add one" onReload={() => {}} />

        <DatePickerField label="Scheduled return date (for insemination)" value={scheduledDate} placeholder="Pick a date" onSelect={setScheduledDate} />

        <AppText variant="body" style={{ fontWeight: '600', marginTop: spacing.xs, marginBottom: spacing.xs }}>
          Sire breed applied <AppText color={colors.error}>*</AppText>
        </AppText>
        <CatalogChips kind="sire_breed" value={sireBreed} onPick={setSireBreed} placeholder="Search breeds, or add a new sire" onReload={() => {}} />

        <TextField label="Source of semen" value={semenSource} onChangeText={setSemenSource} placeholder="e.g. Nagric, or other supplier" />
        <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Any additional detail" multiline />

        <Button label={saving ? t('common.saving') : 'Save AI record'} icon="content-save-check-outline" loading={saving} disabled={!canSave || saving} onPress={onSave} style={{ marginTop: spacing.md }} />
      </Screen>
    </View>
  );
}
