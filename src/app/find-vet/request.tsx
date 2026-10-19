import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { animals as animalsFallback, vets } from '@/data/mock';
import { submitCalloutRequest } from '@/data/api';
import { getHerd } from '@/data/herd';
import { getFarmerPortfolio } from '@/data/portfolio';
import { BOOKING_SLOTS } from '@/data/scheduleSlots';
import { notify } from '@/lib/toast';
import { formatDate } from '@/lib/date';
import { sendLocalNotification } from '@/services/push';
import { useAuth } from '@/services/auth';
import { useResource } from '@/data/hooks';
import { AppointmentMode, Animal, CalloutUrgency } from '@/data/types';
import { useT } from '@/i18n';
import { AppText, Button, DatePickerField, GradientHeader, Icon, PhotoField, PickerField, Screen, TextField } from '@/ui';

const URGENCY = ['Routine', 'Emergency'] as const;
const MODES: { key: AppointmentMode; icon: 'map-marker-check-outline' | 'video-outline' | 'account-switch-outline' }[] = [
  { key: 'onsite', icon: 'map-marker-check-outline' },
  { key: 'video', icon: 'video-outline' },
  { key: 'hybrid', icon: 'account-switch-outline' },
];

// Specific booking time slots (Sep 12 2026): the appointment takes a slot, not
// the whole day, and access is driven by the calendar slot (no preset buffers).
const TIME_SLOTS = BOOKING_SLOTS;

export default function RequestCallout() {
  const router = useRouter();
  const t = useT();
  const { vetId, date, emergency, purpose: purposeParam } = useLocalSearchParams<{ vetId?: string; date?: string; emergency?: string; purpose?: string }>();
  const vet = vetId ? vets.find((v) => v.id === Number(vetId)) : undefined;
  const isEmergency = emergency === '1';
  const { isAdmin } = useAuth();
  const { data: animals } = useResource(getHerd, animalsFallback);
  // Admins can book on a farmer's behalf (Sep 3 2026 standup).
  const { data: farmers } = useResource(getFarmerPortfolio, []);

  const [onBehalfFarmerId, setOnBehalfFarmerId] = useState('');
  const [animal, setAnimal] = useState<Animal | null>(null);
  // Mandatory purpose of the visit (Oct 2026 spec); pre-filled when the farmer
  // arrives from registration / device linkage.
  // Multiple services can be requested in one visit (Oct 2026).
  const [purposes, setPurposes] = useState<string[]>(
    purposeParam === 'Registration' || purposeParam === 'Linkage' ? [purposeParam] : [],
  );
  const togglePurpose = (v: string) => setPurposes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  // Video / hybrid visits get an auto-generated meeting link.
  const [meetingLink, setMeetingLink] = useState('');
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

  // Preferred date for the visit. Pre-filled when the farmer arrived from a
  // vet's availability calendar; otherwise the farmer picks one here, exactly
  // like the Calendar "Schedule activity" flow (date + time are always captured).
  const fromVetCalendar = !!date && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const [prefDate, setPrefDate] = useState(fromVetCalendar ? (date as string) : '');
  const scheduledFor = prefDate && /^\d{4}-\d{2}-\d{2}$/.test(prefDate) ? prefDate : undefined;

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

  // Generate a meeting link once the visit is Video or Hybrid (spec 6); clear it
  // for on-site visits.
  useEffect(() => {
    if (mode === 'video' || mode === 'hybrid') {
      setMeetingLink((prev) => prev || `https://meet.jit.si/ngaren-${Math.random().toString(36).slice(2, 10)}`);
    } else {
      setMeetingLink('');
    }
  }, [mode]);

  const permissionOk = noAnimalYet || allAnimals || permittedIds.length > 0;
  const slotOk = !scheduledFor || !!slot;
  // Purpose options (Oct 2026 spec). Stock taking is only offered for animals
  // identified Physical/Visual or Bluetooth (not satellite-tracked).
  const stockTakeAllowed = !animal || animal.identificationType !== 'satellite';
  const purposeOptions = useMemo(
    () =>
      [
        { label: t('fv.purpose.registration'), value: 'Registration' },
        { label: t('fv.purpose.linkage'), value: 'Linkage' },
        ...(stockTakeAllowed ? [{ label: t('fv.purpose.stocktaking'), value: 'Stocktaking' }] : []),
        { label: t('fv.purpose.health'), value: 'Treatment' },
        { label: t('fv.purpose.advice'), value: 'Consultation' },
        { label: t('fv.purpose.tagging'), value: 'Tagging' },
      ],
    [t, stockTakeAllowed],
  );
  const canSubmit = (!!animal || noAnimalYet) && purposes.length > 0 && tcsAccepted && permissionOk && slotOk;

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
      const purposeLabels = purposes.map((p) => purposeOptions.find((o) => o.value === p)?.label ?? p);
      const purposeNote = purposes.length ? `[Purpose: ${purposeLabels.join(', ')}] ` : '';
      const linkNote = meetingLink ? `[Meeting link: ${meetingLink}] ` : '';
      await submitCalloutRequest({
        vetId: vet?.id,
        animal: animalLabel,
        locationName: locationName || 'Farm',
        urgency: urgency as CalloutUrgency,
        notes: `${purposeNote}${linkNote}${onBehalfNote}${scopeNote}${slotNote}${notes}`.trim() || undefined,
        mode,
        service: purposes.join(', ') || undefined,
        photo: photo || undefined,
        scheduledFor,
        scheduledSlot: slot || undefined,
        accessScope: noAnimalYet ? undefined : allAnimals ? 'all-animals' : 'selected',
        accessAnimals: !noAnimalYet && !allAnimals ? permittedLabels : undefined,
      });
      notify(t('fv.sentToast', { label: animalLabel }));
      // A real on-device notification so the farmer has a durable record + proof
      // notifications work (local — no backend push server needed).
      void sendLocalNotification(
        t('fv.notifTitle'),
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
      <GradientHeader title={isEmergency ? t('findVet.emergency') : t('health.requestVet')} subtitle={vet ? vet.name : isEmergency ? t('fv.subEmergency') : t('fv.subMatched')} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {/* Purpose of the visit — mandatory; one or more services (Oct 2026). */}
        <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
          {t('fv.purposeLabel')} <AppText color={colors.error}>*</AppText>
        </AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          {t('fv.purposeMulti')}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md }}>
          {purposeOptions.map((o) => {
            const on = purposes.includes(o.value);
            return (
              <Pressable
                key={o.value}
                onPress={() => togglePurpose(o.value)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.mdMinus, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.divider }}>
                {on ? <Icon name="check" size={13} color="#fff" /> : null}
                <AppText variant="caption" color={on ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                  {o.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        {isEmergency ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.errorTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.error }}>
            <Icon name="alarm-light-outline" size={20} color={colors.error} />
            <AppText variant="caption" color={colors.error} style={{ flex: 1, fontWeight: '600' }}>
              {t('fv.emergencyBanner')}
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

        {/* Preferred date — a confirmed banner when carried from a vet's
            availability calendar, otherwise a date picker. Date + time are
            always captured, mirroring the Calendar "Schedule activity" flow. */}
        {fromVetCalendar ? (
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
                {formatDate(prefDate)}
              </AppText>
              <AppText variant="caption" color={colors.primaryDark}>
                {vet ? t('fv.selectedFromVet', { name: vet.name }) : t('fv.selectedFromGeneric')}
              </AppText>
            </View>
          </View>
        ) : (
          <DatePickerField
            label={t('fv.preferredDate')}
            value={prefDate}
            placeholder={t('fv.preferredDatePlaceholder')}
            onSelect={setPrefDate}
          />
        )}

        {/* Specific time slot (Sep 12 2026) — books a slot, not the whole day.
            Always shown; required once a preferred date is set. */}
        <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
          {t('fv.timeSlot')}
          {scheduledFor ? ' *' : ''}
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

        {/* Admin-only: book on behalf of a farmer. */}
        {isAdmin ? (
          <PickerField
            label={t('fv.onBehalf')}
            value={onBehalfFarmerId}
            placeholder={t('fv.onBehalfPlaceholder')}
            options={farmerOptions}
            onSelect={pickFarmer}
          />
        ) : null}

        {/* Animal — a selection dialog; picking auto-fills the location. Can be
            skipped entirely (Sep 7 2026): the vet registers the animal on-site. */}
        {!noAnimalYet ? (
          <>
            <PickerField
              label={t('ad.animalTitle')}
              required
              value={animal ? String(animal.id) : ''}
              placeholder={isAdmin && !onBehalfFarmerId ? t('fv.animalPlaceholderFarmer') : t('fv.animalPlaceholder')}
              options={animalOptions}
              onSelect={selectAnimal}
            />
            {animal ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: -spacing.sm, marginBottom: spacing.sm }}>
                <Icon name="map-marker-outline" size={15} color={colors.onSurfaceVariant} />
                <AppText variant="caption" color={colors.onSurfaceVariant}>
                  {t('fv.locationAuto', { loc: locationName || t('fv.locationUnset') })}
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
            {t('fv.noAnimalYet')}
          </AppText>
        </Pressable>

        {/* Appointment mode */}
        <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.sm }}>
          {t('fv.apptType')}
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
                  {t(`fv.${m.key}`)}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* Auto-generated meeting link for video / hybrid visits (spec 6). */}
        {meetingLink ? (
          <Pressable
            onPress={() => Linking.openURL(meetingLink).catch(() => {})}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
            <Icon name="video-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <AppText variant="caption" color={colors.primaryDark} style={{ fontWeight: '700' }}>{t('fv.meetingLink')}</AppText>
              <AppText variant="caption" color={colors.primary} numberOfLines={1}>{meetingLink}</AppText>
            </View>
            <Icon name="open-in-new" size={16} color={colors.primary} />
          </Pressable>
        ) : null}

        {/* Priority — routine / emergency only */}
        <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.sm }}>
          {t('fv.priority')}
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs }}>
          {URGENCY.map((u) => (
            <Button
              key={u}
              label={t(`urgency.${u.toLowerCase()}`)}
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
            {t('fv.slaPrefix', { note: urgency === 'Emergency' ? t('fv.slaEmergency') : t('fv.slaRoutine') })}
          </AppText>
        </View>

        <TextField
          label={t('ad.notes')}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('fv.notesPlaceholder')}
          multiline
        />

        {/* Symptom photo — live capture only (authenticity). */}
        <PhotoField label={t('fv.livePhoto')} value={photo} onChange={setPhoto} liveOnly />

        {/* Multi-animal permission (Sep 12 2026): grant the vet access to all
            animals, or pick specific ones. Clinical work stays per-animal. */}
        {!noAnimalYet ? (
        <>
        <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
          {t('fv.animalsAccess')}
        </AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          {t('fv.accessIntro')}
        </AppText>
        <Pressable
          onPress={() => setAllAnimals((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: allAnimals ? colors.primary : colors.surface, borderWidth: 1, borderColor: allAnimals ? colors.primary : colors.divider, paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
          <Icon name="select-group" size={20} color={allAnimals ? '#fff' : colors.onSurfaceVariant} />
          <AppText variant="body" color={allAnimals ? '#fff' : colors.onSurface} style={{ fontWeight: '600', flex: 1 }}>
            {t('fv.allMyAnimals', { count: bookableAnimals.length })}
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
              <AppText variant="caption" color={colors.onSurfaceVariant}>{t('fv.noAnimalsSelect')}</AppText>
            ) : null}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md }}>
          <Icon name="calendar-clock" size={15} color={colors.onSurfaceVariant} />
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {t('fv.accessLapses')}
          </AppText>
        </View>
        </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
            <Icon name="clipboard-account-outline" size={18} color={colors.primary} />
            <AppText variant="caption" color={colors.primaryDark} style={{ flex: 1 }}>
              {t('fv.vetWillRegister')}
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
          label={submitting ? t('fv.submitting') : t('fv.submit')}
          onPress={onSubmit}
          disabled={!canSubmit || submitting}
        />
      </Screen>
    </View>
  );
}
