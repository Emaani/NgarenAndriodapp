import { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { OUTCOME_LABELS, VisitOutcome, addVetVisit, getVetVisits } from '@/data/vetVisits';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { formatDateTime } from '@/lib/date';
import { ActionChip, AppText, Button, GradientHeader, IconChip, PhotoField, PickerField, Screen, TextField } from '@/ui';

const OUTCOME_OPTIONS = (['healthy', 'treated', 'follow_up'] as VisitOutcome[]).map((v) => ({
  label: OUTCOME_LABELS[v],
  value: v,
}));

const outcomeVariant = (o: VisitOutcome) => (o === 'healthy' ? 'success' : o === 'treated' ? 'info' : 'warning');

/**
 * Vet Visit Log — a veterinarian validates a field visit with findings, the
 * animal's status, and a confirmation photo proving presence. Vets/admins only.
 */
export default function LogVisit() {
  const router = useRouter();
  const { loading, isAuthenticated, canVet, user } = useAuth();
  const { data: visits, reload } = useResource(getVetVisits, []);

  const [animal, setAnimal] = useState('');
  const [outcome, setOutcome] = useState<VisitOutcome>('healthy');
  const [findings, setFindings] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!canVet) return <Redirect href="/(tabs)/home" />;

  const canSubmit = animal.trim() && findings.trim() && photo;

  const onSubmit = async () => {
    setSaving(true);
    await addVetVisit({
      animal: animal.trim(),
      outcome,
      findings: findings.trim(),
      photo,
      vetName: user?.fullName ?? user?.email ?? 'Vet',
    });
    setSaving(false);
    setAnimal('');
    setFindings('');
    setPhoto(null);
    setOutcome('healthy');
    reload();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Log a Visit" subtitle="Validate a field visit with a photo" showBack />
      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        <TextField label="Animal (tag or name)" required value={animal} onChangeText={setAnimal} placeholder="e.g. A-042 or Bull" />
        <PickerField label="Outcome" required value={outcome} options={OUTCOME_OPTIONS} onSelect={(v) => setOutcome(v as VisitOutcome)} />
        <TextField label="Findings" required value={findings} onChangeText={setFindings} placeholder="Observations, treatment given…" multiline />
        <PhotoField label="Confirmation photo (required)" value={photo} onChange={setPhoto} />
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
          The photo confirms your presence and the animal’s status at the visit.
        </AppText>
        <Button label="Log visit" icon="clipboard-check-outline" loading={saving} disabled={!canSubmit} onPress={onSubmit} />

        {visits.length > 0 && (
          <>
            <AppText variant="title" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
              Recent visits ({visits.length})
            </AppText>
            {visits.map((v) => (
              <View
                key={v.id}
                style={[
                  { flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.divider },
                  shadow[1],
                ]}>
                <IconChip icon="stethoscope" />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                    {v.animal}
                  </AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    {formatDateTime(v.loggedAt)} · {v.vetName}
                  </AppText>
                </View>
                <ActionChip label={OUTCOME_LABELS[v.outcome]} variant={outcomeVariant(v.outcome)} />
              </View>
            ))}
          </>
        )}
      </Screen>
    </View>
  );
}
