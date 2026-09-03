import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import {
  HEALTH_OBSERVATIONS,
  HEALTH_TYPE_LABELS,
  HealthEventType,
  HealthObservation,
  addLocalHealthRecord,
} from '@/data/localHealth';
import { notify } from '@/lib/toast';
import { useAuth } from '@/services/auth';
import { AppText, Button, DatePickerField, GradientHeader, PhotoField, PickerField, Screen, TextField } from '@/ui';

const TYPE_OPTIONS = (['vaccination', 'treatment', 'consultation', 'ailment'] as HealthEventType[]).map((t) => ({
  label: HEALTH_TYPE_LABELS[t],
  value: t,
}));

/**
 * Log a new health event (vaccination / treatment / ailment) against an
 * animal's Ngaren code. Available to both farmers and vets, per Horizon One.
 * Reached from an animal's Health History with ?animal=<code>&label=<name>.
 */
export default function AddHealthRecord() {
  const router = useRouter();
  const { animal, label } = useLocalSearchParams<{ animal?: string; label?: string }>();
  const { loading, isAuthenticated, user } = useAuth();

  const [type, setType] = useState<HealthEventType>('vaccination');
  const [medication, setMedication] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [observations, setObservations] = useState<HealthObservation[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleObs = (o: HealthObservation) =>
    setObservations((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]));

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const animalKey = animal ?? '';
  const animalLabel = label ?? animal ?? 'Animal';
  const canSubmit = !!animalKey && notes.trim().length > 0;

  const onSubmit = async () => {
    setSaving(true);
    try {
      await addLocalHealthRecord({
        animalKey,
        animalLabel,
        type,
        medication: medication.trim() || null,
        notes: notes.trim(),
        photo,
        observations: observations.length ? observations : undefined,
        recordedBy: user?.fullName ?? user?.email ?? 'User',
        date: date || today,
      });
      notify('Health record saved');
      router.back();
    } catch {
      setSaving(false);
      notify('Could not save the record — please try again');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="New Health Record" subtitle={animalLabel} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {!animalKey ? (
          <AppText variant="body" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
            Open this from an animal’s Health History to attach the record to that animal.
          </AppText>
        ) : null}
        <PickerField label="Event type" required value={type} options={TYPE_OPTIONS} onSelect={(v) => setType(v as HealthEventType)} />
        <TextField label="Medication / vaccine" value={medication} onChangeText={setMedication} placeholder="e.g. Oxytetracycline" />

        {/* Structured observations for disease/pest trend collection. */}
        <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
          Observations
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md }}>
          {HEALTH_OBSERVATIONS.map((o) => {
            const active = observations.includes(o);
            return (
              <Pressable
                key={o}
                onPress={() => toggleObs(o)}
                style={{ paddingHorizontal: spacing.mdMinus, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: active ? colors.primary : colors.surface, borderWidth: 1, borderColor: active ? colors.primary : colors.divider }}>
                <AppText variant="caption" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                  {o}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <TextField label="Notes" required value={notes} onChangeText={setNotes} placeholder="Findings, dosage, observations…" multiline />
        <DatePickerField label="Event date" value={date} placeholder="Defaults to today" maximumIso={today} onSelect={setDate} />
        {/* Visit photos must be live captures (authenticity) — no gallery. */}
        <PhotoField label="Live photo (optional)" value={photo} onChange={setPhoto} liveOnly />
        <Button label="Save record" icon="content-save-outline" loading={saving} disabled={!canSubmit} onPress={onSubmit} style={{ marginTop: spacing.sm }} />
      </Screen>
    </View>
  );
}
