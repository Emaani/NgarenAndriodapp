import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { animals, locations, vets } from '@/data/mock';
import { submitCalloutRequest } from '@/data/api';
import { CalloutUrgency } from '@/data/types';
import { AppText, Button, GradientHeader, Icon, Screen, SelectField, TextField } from '@/ui';

const URGENCY = ['Routine', 'Soon', 'Emergency'] as const;

export default function RequestCallout() {
  const router = useRouter();
  const { vetId } = useLocalSearchParams<{ vetId?: string }>();
  const vet = vetId ? vets.find((v) => v.id === Number(vetId)) : undefined;

  const [animal, setAnimal] = useState('');
  const [location, setLocation] = useState(locations[0]?.name ?? '');
  const [urgency, setUrgency] = useState<(typeof URGENCY)[number]>('Routine');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!animal || submitting) return;
    setSubmitting(true);
    try {
      await submitCalloutRequest({
        vetId: vet?.id,
        animal,
        locationName: location,
        urgency: urgency as CalloutUrgency,
        notes: notes || undefined,
      });
    } catch {
      // Submission is best-effort here; in mock mode it's a no-op and the
      // farmer still gets routed home. A production build would surface a toast.
    } finally {
      router.replace('/(tabs)/home');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Request a Call-out" subtitle={vet ? vet.name : 'A vet will be assigned'} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {vet && (
          <View
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                padding: spacing.md,
                marginBottom: spacing.md,
              },
              shadow[1],
            ]}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.full,
                backgroundColor: colors.primaryTint,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="stethoscope" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                {vet.name}
              </AppText>
              <AppText variant="body" color={colors.onSurfaceVariant}>
                {vet.clinic} · {vet.distanceKm} km
              </AppText>
            </View>
          </View>
        )}

        <SelectField
          label="Animal"
          required
          value={animal}
          placeholder="Select an animal"
          onPress={() => {
            const idx = animals.findIndex((a) => (a.name ?? a.tag) === animal);
            const next = animals[(idx + 1) % animals.length];
            setAnimal(next.name ?? next.tag);
          }}
        />
        <SelectField
          label="Location"
          required
          value={location}
          onPress={() => {
            const idx = locations.findIndex((l) => l.name === location);
            setLocation(locations[(idx + 1) % locations.length].name);
          }}
        />

        <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.sm }}>
          Urgency *
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          {URGENCY.map((u) => {
            const active = urgency === u;
            return (
              <Button
                key={u}
                label={u}
                variant={active ? 'primary' : 'outline'}
                onPress={() => setUrgency(u)}
                style={{ flex: 1, paddingHorizontal: spacing.sm }}
              />
            );
          })}
        </View>

        <TextField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Describe the symptoms or reason for the call-out..."
          multiline
        />

        <Button
          label={submitting ? 'Submitting…' : 'Submit Request'}
          onPress={onSubmit}
          disabled={!animal || submitting}
          style={{ marginTop: spacing.sm }}
        />
      </Screen>
    </View>
  );
}
