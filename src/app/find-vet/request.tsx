import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { animals as animalsFallback, vets } from '@/data/mock';
import { submitCalloutRequest } from '@/data/api';
import { getHerd } from '@/data/herd';
import { notify } from '@/lib/toast';
import { sendLocalNotification } from '@/services/push';
import { useResource } from '@/data/hooks';
import { AppointmentMode, Animal, CalloutUrgency } from '@/data/types';
import { AppText, Button, GradientHeader, Icon, PhotoField, Screen, SelectField, TextField } from '@/ui';

const URGENCY = ['Routine', 'Emergency'] as const;
const MODES: { key: AppointmentMode; label: string; icon: 'map-marker-check-outline' | 'video-outline' | 'account-switch-outline' }[] = [
  { key: 'onsite', label: 'On-site', icon: 'map-marker-check-outline' },
  { key: 'video', label: 'Video', icon: 'video-outline' },
  { key: 'hybrid', label: 'Hybrid', icon: 'account-switch-outline' },
];
// Access = appointment + buffer. Keeps a vet from having perpetual access to
// farm data (Aug 29 2026 standup): access lapses after the window.
const ACCESS_BUFFERS = [
  { hours: 4, label: 'Within 4 hours' },
  { hours: 24, label: 'Within 24 hours' },
];

export default function RequestCallout() {
  const router = useRouter();
  const { vetId } = useLocalSearchParams<{ vetId?: string }>();
  const vet = vetId ? vets.find((v) => v.id === Number(vetId)) : undefined;
  const { data: animals } = useResource(getHerd, animalsFallback);

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [urgency, setUrgency] = useState<(typeof URGENCY)[number]>('Routine');
  const [mode, setMode] = useState<AppointmentMode>('onsite');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [accessHours, setAccessHours] = useState(24);
  const [tcsAccepted, setTcsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Location is auto-derived from the selected animal's registered location — no
  // manual selection needed (Aug 29 2026 standup).
  const locationName = animal?.locationName ?? '';
  const animalLabel = animal ? animal.name ?? animal.tag : '';

  const cycleAnimal = () => {
    if (animals.length === 0) return;
    const idx = animal ? animals.findIndex((a) => a.id === animal.id) : -1;
    setAnimal(animals[(idx + 1) % animals.length]);
  };

  const onSubmit = async () => {
    if (!animal || !tcsAccepted || submitting) return;
    setSubmitting(true);
    try {
      await submitCalloutRequest({
        vetId: vet?.id,
        animal: animalLabel,
        locationName: locationName || 'Farm',
        urgency: urgency as CalloutUrgency,
        notes: notes || undefined,
        mode,
        photo: photo || undefined,
        accessBufferHours: accessHours,
      });
      notify(`Vet request sent for ${animalLabel}`);
      // A real on-device notification so the farmer has a durable record + proof
      // notifications work (local — no backend push server needed).
      void sendLocalNotification(
        'Vet request sent',
        `${urgency} request for ${animalLabel}${vet ? ` to ${vet.name}` : ''}. We'll notify you when a vet responds.`,
        { type: 'VET_REQUEST' },
      );
    } catch {
      // Best-effort in mock mode; the farmer is still routed home.
    } finally {
      router.replace('/(tabs)/home');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Request a Vet" subtitle={vet ? vet.name : 'A nearby vet will be matched'} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {vet && (
          <View
            style={[
              { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
              shadow[1],
            ]}>
            <View style={{ width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="stethoscope" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                {vet.name}
              </AppText>
              <AppText variant="body" color={colors.onSurfaceVariant}>
                {vet.clinic} · {vet.distanceKm} km · {vet.rating}★
              </AppText>
            </View>
          </View>
        )}

        {/* Animal — selecting it auto-fills the location from its registration. */}
        <SelectField
          label="Animal"
          required
          value={animalLabel}
          placeholder="Select an animal"
          onPress={cycleAnimal}
        />
        {animal ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: -spacing.sm, marginBottom: spacing.md }}>
            <Icon name="map-marker-outline" size={15} color={colors.onSurfaceVariant} />
            <AppText variant="caption" color={colors.onSurfaceVariant}>
              Location: {locationName || 'Not set on this animal'} · auto-selected
            </AppText>
          </View>
        ) : null}

        {/* Appointment mode */}
        <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.sm }}>
          Appointment type *
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          {MODES.map((m) => {
            const active = mode === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => setMode(m.key)}
                style={{ flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: active ? colors.primary : colors.surface, borderWidth: 1, borderColor: active ? colors.primary : colors.divider }}>
                <Icon name={m.icon} size={20} color={active ? '#fff' : colors.onSurfaceVariant} />
                <AppText variant="caption" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                  {m.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* Priority — routine / emergency only */}
        <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.sm }}>
          Priority *
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          {URGENCY.map((u) => (
            <Button
              key={u}
              label={u}
              variant={urgency === u ? 'primary' : 'outline'}
              onPress={() => setUrgency(u)}
              style={{ flex: 1, paddingHorizontal: spacing.sm }}
            />
          ))}
        </View>

        <TextField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Describe the symptoms or reason for the visit..."
          multiline
        />

        {/* Optional symptom photo */}
        <PhotoField label="Photo (optional)" value={photo} onChange={setPhoto} />

        {/* Time-limited access window */}
        <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
          Grant records access
        </AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          The vet can view this animal’s health records for the appointment plus this buffer — access lapses after.
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          {ACCESS_BUFFERS.map((b) => (
            <Button
              key={b.hours}
              label={b.label}
              variant={accessHours === b.hours ? 'primary' : 'outline'}
              onPress={() => setAccessHours(b.hours)}
              style={{ flex: 1, paddingHorizontal: spacing.sm }}
            />
          ))}
        </View>

        {/* Consent */}
        <Pressable onPress={() => setTcsAccepted((v) => !v)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md }}>
          <Icon name={tcsAccepted ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={tcsAccepted ? colors.primary : colors.onSurfaceVariant} />
          <AppText variant="body" color={colors.onSurface} style={{ flex: 1 }}>
            I accept the booking & managed-health terms & conditions, and consent to time-limited records access for this appointment.
          </AppText>
        </Pressable>

        <Button
          label={submitting ? 'Submitting…' : 'Submit Request'}
          onPress={onSubmit}
          disabled={!animal || !tcsAccepted || submitting}
        />
      </Screen>
    </View>
  );
}
