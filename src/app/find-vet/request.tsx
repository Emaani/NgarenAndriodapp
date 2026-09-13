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
// escalation; emergency has a 4h response window.
const SLA: Record<(typeof URGENCY)[number], { responseHrs: number; note: string }> = {
  Routine: { responseHrs: 48, note: 'Response within 48 hours' },
  Emergency: { responseHrs: 4, note: 'Response within 4 hours' },
};
const MODES: { key: AppointmentMode; label: string; icon: 'map-marker-check-outline' | 'video-outline' | 'account-switch-outline' }[] = [
  { key: 'onsite', label: 'On-site', icon: 'map-marker-check-outline' },
  { key: 'video', label: 'Video', icon: 'video-outline' },
  { key: 'hybrid', label: 'Hybrid', icon: 'account-switch-outline' },
];

// Specific booking time slots (Sep 12 2026): the appointment takes a slot, not
// the whole day, and access is driven by the calendar slot (no preset buffers).
const TIME_SLOTS = ['08:00–10:00', '10:00–12:00', '12:00–14:00', '14:00–16:00', '16:00–18:00'];

export default function RequestCallout() {
  const router = useRouter();
  const { vetId, date, emergency } = useLocalSearchParams<{ vetId?: string; date?: string; emergency?: string }>();
  const vet = vetId ? vets.find((v) => v.id === Number(vetId)) : undefined;
  const isEmergency = emergency === '1';
  const { isAdmin } = useAuth();
  const { data: animals } = useResource(getHerd, animalsFallback);
  // Admins can book on a farmer's behalf (Sep 3 2026 standup).
  const { data: farmers } = useResource(getFarmerPortfolio, []);

  const [onBehalfFarmerId, setOnBehalfFarmerId] = useState('');
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [urgency, setUrgency] = useState<(typeof URGENCY)[number]>(emergency === '1' ? 'Emergency' : 'Routine');
  const [mode, setMode] = useState<AppointmentMode>('onsite');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  // Multi-animal booking permission (Sep 12 2026): grant access to all animals,
  // or pick specific ones. Clinical work is still recorded per-animal later.
  const [allAnimals, setAllAnimals] = useState(false);
  const [permittedIds, setPermittedIds] = useState<number[]>([]);
  // Chosen time slot within the selected day (Sep 12 2026).
  const [slot, setSlot] = useState('');
  // Onboarding simplification (Sep 7 2026): a farmer may book without first
  // registering the animal — the vet registers it during the service visit.
  const [noAnimalYet, setNoAnimalYet] = useState(false);
  const [tcsAccepted, setTcsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // A chosen calendar slot carried from the vet's availability calendar.
  const scheduledFor = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;

  // Location is auto-derived from the selected animal's registered location — no
  // manual selection needed (Aug 29 2026 standup).
  const locationName = animal?.locationName ?? '';
  const animalLabel = noAnimalYet ? 'New animal — vet to register' : animal ? animal.name ?? animal.tag : '';

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
  const selectAnimal = (v: string) => {
    const a = bookableAnimals.find((x) => String(x.id) === v) ?? null;
    setAnimal(a);
    // The visit's primary animal is permitted by default.
    if (a && !permittedIds.includes(a.id)) setPermittedIds((prev) => [...prev, a.id]);
  };
  const pickFarmer = (v: string) => {
    setOnBehalfFarmerId(v);
    setAnimal(null); // re-scope the animal list to the chosen farmer
    setPermittedIds([]);
  };
  const togglePermitted = (id: number) =>
    setPermittedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const pickUrgency = (u: (typeof URGENCY)[number]) => setUrgency(u);

  // Labels of animals the vet will be permitted to access.
  const permittedLabels = allAnimals
    ? bookableAnimals.map((a) => a.name ?? a.tag)
    : bookableAnimals.filter((a) => permittedIds.includes(a.id)).map((a) => a.name ?? a.tag);

  const permissionOk = noAnimalYet || allAnimals || permittedIds.length > 0;
  const slotOk = !scheduledFor || !!slot;
  const canSubmit = (!!animal || noAnimalYet) && tcsAccepted && permissionOk && slotOk;

  const onSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const onBehalfNote = onBehalfFarmerName ? `[On behalf of ${onBehalfFarmerName}] ` : '';
      const scopeNote = noAnimalYet
        ? '[New animal — vet to register on-site] '
        : allAnimals
          ? '[Access: all animals] '
          : `[Access: ${permittedLabels.length || 1} animal${permittedLabels.length === 1 ? '' : 's'}] `;
      const slotNote = scheduledFor && slot ? `[Slot: ${formatDate(scheduledFor)} ${slot}] ` : '';
      await submitCalloutRequest({
        vetId: vet?.id,
        animal: animalLabel,
        locationName: locationName || 'Farm',
        urgency: urgency as CalloutUrgency,
        notes: `${onBehalfNote}${scopeNote}${slotNote}${notes}`.trim() || undefined,
        mode,
        photo: photo || undefined,
        scheduledFor,
        scheduledSlot: slot || undefined,
        accessScope: noAnimalYet ? undefined : allAnimals ? 'all-animals' : 'selected',
        accessAnimals: !noAnimalYet && !allAnimals ? permittedLabels : undefined,
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
      <GradientHeader title={isEmergency ? 'Emergency call-out' : 'Request a Vet'} subtitle={vet ? vet.name : isEmergency ? 'Available vets will be alerted now' : 'A nearby vet will be matched'} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {isEmergency ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.errorTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.error }}>
            <Icon name="alarm-light-outline" size={20} color={colors.error} />
            <AppText variant="caption" color={colors.error} style={{ flex: 1, fontWeight: '600' }}>
              Emergency request — we’ll alert available vets near you immediately. No time slot needed.
            </AppText>
          </View>
        ) : null}
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

        {/* Specific time slot (Sep 12 2026) — books a slot, not the whole day. */}
        {scheduledFor ? (
          <>
            <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
              Time slot *
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md }}>
              {TIME_SLOTS.map((s) => {
                const active = slot === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setSlot(s)}
                    style={{ paddingHorizontal: spacing.mdMinus, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: active ? colors.primary : colors.surface, borderWidth: 1, borderColor: active ? colors.primary : colors.divider }}>
                    <AppText variant="caption" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                      {s}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </>
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

        {/* Animal — a selection dialog; picking auto-fills the location. Can be
            skipped entirely (Sep 7 2026): the vet registers the animal on-site. */}
        {!noAnimalYet ? (
          <>
            <PickerField
              label="Animal"
              required
              value={animal ? String(animal.id) : ''}
              placeholder={isAdmin && !onBehalfFarmerId ? 'Select a farmer first, or any animal' : 'Select an animal'}
              options={animalOptions}
              onSelect={selectAnimal}
            />
            {animal ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: -spacing.sm, marginBottom: spacing.sm }}>
                <Icon name="map-marker-outline" size={15} color={colors.onSurfaceVariant} />
                <AppText variant="caption" color={colors.onSurfaceVariant}>
                  Location: {locationName || 'Not set on this animal'} · auto-selected
                </AppText>
              </View>
            ) : null}
          </>
        ) : null}
        <Pressable
          onPress={() => setNoAnimalYet((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md }}>
          <Icon name={noAnimalYet ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={noAnimalYet ? colors.primary : colors.onSurfaceVariant} />
          <AppText variant="body" color={colors.onSurface} style={{ flex: 1 }}>
            I haven’t registered this animal yet — the vet will register it during the visit.
          </AppText>
        </Pressable>

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

        {/* Multi-animal permission (Sep 12 2026): grant the vet access to all
            animals, or pick specific ones. Clinical work stays per-animal. */}
        {!noAnimalYet ? (
        <>
        <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
          Animals the vet may access
        </AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          Grant access for this visit’s window only. Pick specific animals, or all your animals. The vet records each intervention per animal on-site.
        </AppText>
        <Pressable
          onPress={() => setAllAnimals((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: allAnimals ? colors.primary : colors.surface, borderWidth: 1, borderColor: allAnimals ? colors.primary : colors.divider, paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
          <Icon name="select-group" size={20} color={allAnimals ? '#fff' : colors.onSurfaceVariant} />
          <AppText variant="body" color={allAnimals ? '#fff' : colors.onSurface} style={{ fontWeight: '600', flex: 1 }}>
            All my animals ({bookableAnimals.length})
          </AppText>
          {allAnimals ? <Icon name="check" size={18} color="#fff" /> : null}
        </Pressable>
        {!allAnimals ? (
          <View style={{ marginBottom: spacing.md, gap: spacing.xs }}>
            {bookableAnimals.slice(0, 12).map((a) => {
              const on = permittedIds.includes(a.id);
              return (
                <Pressable
                  key={a.id}
                  onPress={() => togglePermitted(a.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}>
                  <Icon name={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={on ? colors.primary : colors.onSurfaceVariant} />
                  <AppText variant="body" color={colors.onSurface} style={{ flex: 1 }}>
                    {a.accountNumber ?? a.tag}
                    {a.name ? ` · ${a.name}` : ''}
                  </AppText>
                </Pressable>
              );
            })}
            {bookableAnimals.length === 0 ? (
              <AppText variant="caption" color={colors.onSurfaceVariant}>No registered animals to select.</AppText>
            ) : null}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md }}>
          <Icon name="calendar-clock" size={15} color={colors.onSurfaceVariant} />
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            Access lapses automatically at the end of the booked time slot.
          </AppText>
        </View>
        </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
            <Icon name="clipboard-account-outline" size={18} color={colors.primary} />
            <AppText variant="caption" color={colors.primaryDark} style={{ flex: 1 }}>
              The vet will register the animal and capture its first scorecard during the visit. You can review and approve the record afterwards.
            </AppText>
          </View>
        )}

        {/* Consent */}
        <Pressable onPress={() => setTcsAccepted((v) => !v)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md }}>
          <Icon name={tcsAccepted ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={tcsAccepted ? colors.primary : colors.onSurfaceVariant} />
          <AppText variant="body" color={colors.onSurface} style={{ flex: 1 }}>
            {noAnimalYet
              ? 'I accept the booking & managed-health terms & conditions, and consent to the vet registering my animal and recording its health data during this visit.'
              : `I accept the booking & managed-health terms & conditions, and consent to ${allAnimals ? 'all my animals’' : 'the selected animals’'} records being accessible to the vet for the booked time slot only.`}
          </AppText>
        </Pressable>

        <Button
          label={submitting ? 'Submitting…' : 'Submit Request'}
          onPress={onSubmit}
          disabled={!canSubmit || submitting}
        />
      </Screen>
    </View>
  );
}
