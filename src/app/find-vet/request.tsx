import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { animals as animalsFallback, vets } from '@/data/mock';
import { submitCalloutRequest } from '@/data/api';
import { getHerd } from '@/data/herd';
import { getFarmerPortfolio } from '@/data/portfolio';
import { notify } from '@/lib/toast';
import { formatDate } from '@/lib/date';
import { sendLocalNotification } from '@/services/push';
import { useAuth } from '@/services/auth';
import { useResource } from '@/data/hooks';
import { AppointmentMode, Animal, CalloutUrgency } from '@/data/types';
import { AppText, Button, GradientHeader, Icon, PhotoField, PickerField, Screen, TextField } from '@/ui';

const URGENCY = ['Routine', 'Emergency'] as const;
// SLA per priority tier (Sep 3 2026 standup): routine sits up to 48h before
// escalation; emergency has a 4h response window. The records-access buffer
// defaults from the tier so it matches the appointment window.
const SLA: Record<(typeof URGENCY)[number], { responseHrs: number; defaultAccess: number; note: string }> = {
  Routine: { responseHrs: 48, defaultAccess: 24, note: 'Response within 48 hours' },
  Emergency: { responseHrs: 4, defaultAccess: 4, note: 'Response within 4 hours' },
};
const MODES: { key: AppointmentMode; label: string; icon: 'map-marker-check-outline' | 'video-outline' | 'account-switch-outline' }[] = [
  { key: 'onsite', label: 'On-site', icon: 'map-marker-check-outline' },
  { key: 'video', label: 'Video', icon: 'video-outline' },
  { key: 'hybrid', label: 'Hybrid', icon: 'account-switch-outline' },
];
// Access = appointment + buffer. Keeps a vet from having perpetual access to
// farm data: access lapses after the window.
const ACCESS_BUFFERS = [
  { hours: 4, label: 'Within 4 hours' },
  { hours: 24, label: 'Within 24 hours' },
];

// Animal-access scope for the visit (Sep 5 2026 standup): the farmer decides
// which animals the vet may access during the appointment window.
type AccessScope = 'this-animal' | 'all-animals';
const ACCESS_SCOPES: { key: AccessScope; label: string; icon: 'cow' | 'cow-off' | 'select-group' }[] = [
  { key: 'this-animal', label: 'This animal only', icon: 'cow' },
  { key: 'all-animals', label: 'All my animals', icon: 'select-group' },
];

export default function RequestCallout() {
  const router = useRouter();
  const { vetId, date } = useLocalSearchParams<{ vetId?: string; date?: string }>();
  const vet = vetId ? vets.find((v) => v.id === Number(vetId)) : undefined;
  const { isAdmin } = useAuth();
  const { data: animals } = useResource(getHerd, animalsFallback);
  // Admins can book on a farmer's behalf (Sep 3 2026 standup).
  const { data: farmers } = useResource(getFarmerPortfolio, []);

  const [onBehalfFarmerId, setOnBehalfFarmerId] = useState('');
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [urgency, setUrgency] = useState<(typeof URGENCY)[number]>('Routine');
  const [mode, setMode] = useState<AppointmentMode>('onsite');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [accessHours, setAccessHours] = useState(24);
  const [accessScope, setAccessScope] = useState<AccessScope>('this-animal');
  const [tcsAccepted, setTcsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // A chosen calendar slot carried from the vet's availability calendar.
  const scheduledFor = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;

  // Location is auto-derived from the selected animal's registered location — no
  // manual selection needed (Aug 29 2026 standup).
  const locationName = animal?.locationName ?? '';
  const animalLabel = animal ? animal.name ?? animal.tag : '';

  const farmerOptions = useMemo(
    () => farmers.map((f) => ({ label: f.farmerName, value: f.id })),
    [farmers],
  );
  const onBehalfFarmerName = farmers.find((f) => f.id === onBehalfFarmerId)?.farmerName;

  // Animals to choose from — for an admin booking on a farmer's behalf, scope to
  // that farmer's animals once one is chosen.
  const bookableAnimals = useMemo(
    () => (isAdmin && onBehalfFarmerId ? animals.filter((a) => a.farmerId === onBehalfFarmerId) : animals),
    [isAdmin, onBehalfFarmerId, animals],
  );

  // Animal selection dialog options (account number + name), per the Sep 3
  // standup ("add selection dialogs" for animal selection).
  const animalOptions = useMemo(
    () =>
      bookableAnimals.map((a) => ({
        label: `${a.accountNumber ?? a.tag}${a.name ? ` · ${a.name}` : ''}`,
        value: String(a.id),
      })),
    [bookableAnimals],
  );
  const selectAnimal = (v: string) => setAnimal(bookableAnimals.find((a) => String(a.id) === v) ?? null);
  const pickFarmer = (v: string) => {
    setOnBehalfFarmerId(v);
    setAnimal(null); // re-scope the animal list to the chosen farmer
  };

  // Picking a priority sets the matching records-access window from its SLA.
  const pickUrgency = (u: (typeof URGENCY)[number]) => {
    setUrgency(u);
    setAccessHours(SLA[u].defaultAccess);
  };

  const onSubmit = async () => {
    if (!animal || !tcsAccepted || submitting) return;
    setSubmitting(true);
    try {
      const onBehalfNote = onBehalfFarmerName ? `[On behalf of ${onBehalfFarmerName}] ` : '';
      const scopeNote =
        accessScope === 'all-animals' ? '[Access: all animals] ' : '[Access: booked animal only] ';
      await submitCalloutRequest({
        vetId: vet?.id,
        animal: animalLabel,
        locationName: locationName || 'Farm',
        urgency: urgency as CalloutUrgency,
        notes: `${onBehalfNote}${scopeNote}${notes}`.trim() || undefined,
        mode,
        photo: photo || undefined,
        accessBufferHours: accessHours,
        scheduledFor,
        accessScope,
        accessAnimals: accessScope === 'this-animal' && animalLabel ? [animalLabel] : undefined,
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

        {/* Chosen calendar slot from the preferred vet's availability. */}
        {scheduledFor ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              backgroundColor: colors.primaryTint,
              borderRadius: radius.md,
              padding: spacing.md,
              marginBottom: spacing.md,
            }}>
            <Icon name="calendar-check" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <AppText variant="body" style={{ fontWeight: '700' }} color={colors.primaryDark}>
                {formatDate(scheduledFor)}
              </AppText>
              <AppText variant="caption" color={colors.primaryDark}>
                Selected from {vet ? `${vet.name}’s` : 'the vet’s'} availability
              </AppText>
            </View>
          </View>
        ) : null}

        {/* Admin-only: book on behalf of a farmer. */}
        {isAdmin ? (
          <PickerField
            label="Booking on behalf of"
            value={onBehalfFarmerId}
            placeholder="Select a farmer (optional)"
            options={farmerOptions}
            onSelect={pickFarmer}
          />
        ) : null}

        {/* Animal — a selection dialog; picking auto-fills the location. */}
        <PickerField
          label="Animal"
          required
          value={animal ? String(animal.id) : ''}
          placeholder={isAdmin && !onBehalfFarmerId ? 'Select a farmer first, or any animal' : 'Select an animal'}
          options={animalOptions}
          onSelect={selectAnimal}
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
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs }}>
          {URGENCY.map((u) => (
            <Button
              key={u}
              label={u}
              variant={urgency === u ? 'primary' : 'outline'}
              onPress={() => pickUrgency(u)}
              style={{ flex: 1, paddingHorizontal: spacing.sm }}
            />
          ))}
        </View>
        {/* SLA for the chosen tier. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md }}>
          <Icon name={urgency === 'Emergency' ? 'alarm-light-outline' : 'clock-outline'} size={15} color={urgency === 'Emergency' ? colors.error : colors.onSurfaceVariant} />
          <AppText variant="caption" color={urgency === 'Emergency' ? colors.error : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
            SLA: {SLA[urgency].note}
          </AppText>
        </View>

        <TextField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Describe the symptoms or reason for the visit..."
          multiline
        />

        {/* Symptom photo — live capture only (authenticity). */}
        <PhotoField label="Live photo (optional)" value={photo} onChange={setPhoto} liveOnly />

        {/* Animal-specific permission (Sep 5 2026): which animals the vet may
            access during this visit. */}
        <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
          Animals the vet may access
        </AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          Limit the visit to the booked animal, or grant access to your whole herd for this appointment.
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          {ACCESS_SCOPES.map((sc) => {
            const active = accessScope === sc.key;
            return (
              <Pressable
                key={sc.key}
                onPress={() => setAccessScope(sc.key)}
                style={{ flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: active ? colors.primary : colors.surface, borderWidth: 1, borderColor: active ? colors.primary : colors.divider }}>
                <Icon name={sc.icon} size={20} color={active ? '#fff' : colors.onSurfaceVariant} />
                <AppText variant="caption" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600', textAlign: 'center' }}>
                  {sc.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* Time-limited access window */}
        <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
          Access time window
        </AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          The vet can view the {accessScope === 'all-animals' ? 'herd’s' : 'animal’s'} health records for the appointment plus this buffer — access lapses after.
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
            I accept the booking & managed-health terms & conditions, and consent to {accessScope === 'all-animals' ? 'all my animals’' : 'the booked animal’s'} records being accessible to the vet for this appointment window only.
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
