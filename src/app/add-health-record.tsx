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
import { scheduleLocalReminder } from '@/services/push';
import { useAuth } from '@/services/auth';
import { AppText, Button, DatePickerField, GradientHeader, PhotoField, PickerField, Screen, TextField } from '@/ui';

const TYPE_OPTIONS = (['vaccination', 'treatment', 'consultation', 'ailment'] as HealthEventType[]).map((t) => ({
  label: HEALTH_TYPE_LABELS[t],
  value: t,
}));

// Per-service diagnostic templates (Sep 3 2026 standup): picking the event type
// launches the fields relevant to that service.
const TEMPLATES: Record<
  HealthEventType,
  { medicationLabel?: string; medicationPlaceholder?: string; showDiagnosis?: boolean; showNextDue?: boolean; notesLabel: string; notesPlaceholder: string }
> = {
  vaccination: { medicationLabel: 'Vaccine', medicationPlaceholder: 'e.g. FMD, Lumpy skin', showNextDue: true, notesLabel: 'Notes', notesPlaceholder: 'Batch, dose, injection site…' },
  treatment: { medicationLabel: 'Medication / dosage', medicationPlaceholder: 'e.g. Oxytetracycline 10ml', showDiagnosis: true, notesLabel: 'Notes', notesPlaceholder: 'Findings, response to treatment…' },
  consultation: { notesLabel: 'Advice given', notesPlaceholder: 'Consultation summary & advice…' },
  ailment: { notesLabel: 'Symptoms', notesPlaceholder: 'Observed symptoms…' },
};

/**
 * Log a new health event (vaccination / treatment / ailment) against an
 * animal's Ngaren code. Available to both farmers and vets, per Horizon One.
 * Reached from an animal's Health History with ?animal=<code>&label=<name>.
 */
export default function AddHealthRecord() {
  const router = useRouter();
  const { animal, label, type: presetType } = useLocalSearchParams<{ animal?: string; label?: string; type?: string }>();
  const { loading, isAuthenticated, user } = useAuth();

  const initialType = (['vaccination', 'treatment', 'consultation', 'ailment'] as string[]).includes(presetType ?? '')
    ? (presetType as HealthEventType)
    : 'vaccination';
  const [type, setType] = useState<HealthEventType>(initialType);
  const [medication, setMedication] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [nextDue, setNextDue] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [observations, setObservations] = useState<HealthObservation[]>([]);
  const [saving, setSaving] = useState(false);

  const tpl = TEMPLATES[type];

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
        diagnosis: tpl.showDiagnosis ? diagnosis.trim() || null : null,
        nextDueDate: tpl.showNextDue ? nextDue || null : null,
        notes: notes.trim(),
        photo,
        observations: observations.length ? observations : undefined,
        recordedBy: user?.fullName ?? user?.email ?? 'User',
        date: date || today,
      });
      // Vaccination with a next-dose date → schedule a real reminder.
      if (tpl.showNextDue && nextDue) {
        void scheduleLocalReminder({
          title: 'Vaccination due',
          body: `${animalLabel}: ${medication.trim() || 'vaccination'} is due.`,
          date: new Date(`${nextDue}T09:00:00`),
          data: { type: 'HEALTH_DUE', animal: animalKey },
        });
      }
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

        {/* Type-specific diagnostic template fields. */}
        {tpl.showDiagnosis ? (
          <TextField label="Diagnosis" value={diagnosis} onChangeText={setDiagnosis} placeholder="e.g. Tick-borne fever" />
        ) : null}
        {tpl.medicationLabel ? (
          <TextField label={tpl.medicationLabel} value={medication} onChangeText={setMedication} placeholder={tpl.medicationPlaceholder} />
        ) : null}
        {tpl.showNextDue ? (
          <DatePickerField label="Next dose due (sets a reminder)" value={nextDue} placeholder="Optional" onSelect={setNextDue} />
        ) : null}

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

        <TextField label={tpl.notesLabel} required value={notes} onChangeText={setNotes} placeholder={tpl.notesPlaceholder} multiline />
        <DatePickerField label="Event date" value={date} placeholder="Defaults to today" maximumIso={today} onSelect={setDate} />
        {/* Visit photos must be live captures (authenticity) — no gallery. */}
        <PhotoField label="Live photo (optional)" value={photo} onChange={setPhoto} liveOnly />
        <Button label="Save record" icon="content-save-outline" loading={saving} disabled={!canSubmit} onPress={onSubmit} style={{ marginTop: spacing.sm }} />
      </Screen>
    </View>
  );
}
