import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import { HEALTH_TYPE_LABELS, HealthEventType, addLocalHealthRecord } from '@/data/localHealth';
import { useAuth } from '@/services/auth';
import { AppText, Button, DatePickerField, GradientHeader, PhotoField, PickerField, Screen, TextField } from '@/ui';

const TYPE_OPTIONS = (['vaccination', 'treatment', 'ailment'] as HealthEventType[]).map((t) => ({
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
  const [saving, setSaving] = useState(false);

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
        recordedBy: user?.fullName ?? user?.email ?? 'User',
        date: date || today,
      });
      router.back();
    } catch {
      setSaving(false);
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
        <TextField label="Notes" required value={notes} onChangeText={setNotes} placeholder="Findings, dosage, observations…" multiline />
        <DatePickerField label="Event date" value={date} placeholder="Defaults to today" maximumIso={today} onSelect={setDate} />
        <PhotoField label="Photo (optional)" value={photo} onChange={setPhoto} />
        <Button label="Save record" icon="content-save-outline" loading={saving} disabled={!canSubmit} onPress={onSubmit} style={{ marginTop: spacing.sm }} />
      </Screen>
    </View>
  );
}
