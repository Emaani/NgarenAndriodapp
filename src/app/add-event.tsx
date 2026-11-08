import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { CalendarType } from '@/data/clinical';
import { addLocalEvent } from '@/data/localEvents';
import { submitCalloutRequest } from '@/data/api';
import { getVetSchedule } from '@/data/callouts';
import { getHerd } from '@/data/herd';
import { getDrafts } from '@/data/localRegistrationDrafts';
import { assignRecordsToVet } from '@/data/recordAssignments';
import { getVetDirectory } from '@/data/vetDirectory';
import { getEnlistedVets } from '@/data/vetEnlistments';
import { getNearbyRadiusKm, RADIUS_OPTIONS, setNearbyRadiusKm } from '@/data/vetPrefs';
import { getFarmLocation } from '@/data/farmLocation';
import { useResource } from '@/data/hooks';
import { AppointmentMode, CalloutUrgency, Vet } from '@/data/types';
import { distanceMeters } from '@/lib/geo';
import {
  Availability,
  REPEATS,
  Repeat,
  ScheduleEntry,
  TIME_OPTIONS,
  availabilityAt,
  occurrences,
  shiftDate,
  slotText,
  spanDays,
  timeProblem,
} from '@/lib/scheduling';
import { useAuth } from '@/services/auth';
import { notify } from '@/lib/toast';
import { serviceCode } from '@/lib/serviceCodes';
import { useT } from '@/i18n';
import { AppText, Button, DatePickerField, GradientHeader, Icon, PickerField, Screen, TextField } from '@/ui';

// The services a farmer can ask for (Tester feedback 2026-11-07), as stored on
// bookings, with the calendar type a personal reminder uses.
const SERVICES: { value: string; label: string; type: CalendarType }[] = [
  { value: 'Registration', label: 'ae.svc.registration', type: 'vet_visit' },
  { value: 'Stocktaking', label: 'ae.svc.stocktake', type: 'stock_take' },
  { value: 'Treatment', label: 'ae.svc.treatment', type: 'vet_visit' },
  { value: 'Vaccination', label: 'ae.svc.vaccination', type: 'vaccination' },
  { value: 'Linkage', label: 'ae.svc.linkage', type: 'tagging' },
  { value: 'Follow-up', label: 'ae.svc.followUp', type: 'follow_up' },
];
const MODES: { key: AppointmentMode; icon: 'map-marker-check-outline' | 'web' | 'account-switch-outline' }[] = [
  { key: 'onsite', icon: 'map-marker-check-outline' },
  { key: 'video', icon: 'web' },
  { key: 'hybrid', icon: 'account-switch-outline' },
];
const NGAREN = 'ngaren';
const ME = 'me';
const AVAIL_TINT: Record<Availability, string> = { available: colors.success, tentative: colors.warning, busy: colors.error, unknown: colors.onSurfaceVariant };

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ paddingHorizontal: spacing.mdMinus, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.divider }}>
      <AppText variant="caption" color={on ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>{label}</AppText>
    </Pressable>
  );
}

const Label = ({ text, required }: { text: string; required?: boolean }) => (
  <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
    {text}
    {required ? <AppText color={colors.error}> *</AppText> : null}
  </AppText>
);

/**
 * Book a service from Manage Calendar (Tester feedback 2026-11-07): who is
 * invited (an enlisted vet in range, with their availability, or Ngaren
 * Service Support), the type of meeting, the service, how it is held, start
 * and end, repeats, and the animals the farmer consents to having serviced.
 * Each visit is a real booking the vet sees and answers. "Just me" keeps a
 * personal reminder on this phone, as the calendar did before.
 */
export default function AddEvent() {
  const router = useRouter();
  const t = useT();
  const { loading, isAuthenticated, user } = useAuth();
  const { date: presetDate } = useLocalSearchParams<{ date?: string }>();
  const today = new Date().toISOString().slice(0, 10);

  const { data: directory } = useResource(getVetDirectory, []);
  const { data: enlisted } = useResource(getEnlistedVets, []);
  const { data: herd } = useResource(getHerd, []);
  const { data: drafts } = useResource(getDrafts, []);
  const { data: farm } = useResource(() => getFarmLocation(user?.id), null);
  const { data: savedRadius } = useResource(getNearbyRadiusKm, 5);

  const [invitee, setInvitee] = useState<string>(NGAREN);
  const [urgency, setUrgency] = useState<CalloutUrgency>('Routine');
  const [service, setService] = useState('Registration');
  const [mode, setMode] = useState<AppointmentMode>('onsite');
  const [startDate, setStartDate] = useState(presetDate ?? today);
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState(presetDate ?? today);
  const [endTime, setEndTime] = useState('10:00');
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [until, setUntil] = useState('');
  const [allAnimals, setAllAnimals] = useState(false);
  const [aans, setAans] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [schedules, setSchedules] = useState<Record<string, ScheduleEntry[]>>({});
  const km = radiusKm ?? savedRadius;

  // Vets: the live directory and admin-enlisted vets, with their distance from
  // the farm when both positions are known.
  const vets = useMemo(() => {
    const seen = new Set<number>();
    return [...enlisted, ...directory]
      .filter((v) => !seen.has(v.id) && !!seen.add(v.id))
      .map((v) => {
        const fromFarm = v.coordinates && farm?.coords ? Math.round(distanceMeters(farm.coords, v.coordinates) / 100) / 10 : v.distanceKm;
        return { ...v, distanceKm: fromFarm };
      });
  }, [enlisted, directory, farm]);
  const inRange = vets.filter((v) => v.distanceKm > 0 && v.distanceKm <= km).sort((a, b) => a.distanceKm - b.distanceKm);
  const unknownDistance = vets.filter((v) => !(v.distanceKm > 0));
  const chosenVet: Vet | undefined = vets.find((v) => String(v.id) === invitee);

  // Each vet's committed times, for "available / tentative / busy" at the asked time.
  useEffect(() => {
    vets.forEach((v) => {
      if (v.userId && !schedules[v.userId]) {
        getVetSchedule(v.userId).then((entries) => setSchedules((prev) => ({ ...prev, [v.userId as string]: entries })));
      }
    });
    // schedules is read to skip ones already loaded, not to re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vets]);
  const availabilityOf = (v: Vet): Availability => (v.userId ? availabilityAt(schedules[v.userId] ?? [], startDate, startTime, endTime) : 'unknown');

  // Keep the end on or after the start as the start moves.
  useEffect(() => {
    if (endDate < startDate) setEndDate(startDate);
  }, [startDate, endDate]);

  // Animals: registration also offers the farmer's incomplete records.
  const animalChoices = useMemo(() => {
    const own = herd.filter((a) => !!a.ngarenCode).map((a) => ({ aan: a.ngarenCode as string, name: a.name !== a.ngarenCode ? a.name : undefined, draft: false }));
    const open = service === 'Registration' ? drafts.filter((d) => !d.assignedToVet).map((d) => ({ aan: d.aan, name: d.name || undefined, draft: true })) : [];
    return [...open, ...own.filter((a) => !open.some((d) => d.aan === a.aan))];
  }, [herd, drafts, service]);
  const chosen = allAnimals ? animalChoices.map((a) => a.aan) : aans;
  const toggle = (aan: string) => setAans((prev) => (prev.includes(aan) ? prev.filter((x) => x !== aan) : [...prev, aan]));

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const forMe = invitee === ME;
  const problem = timeProblem(startDate, startTime, endDate, endTime);
  const dates = occurrences(startDate, repeat, until || undefined);
  const serviceLabel = t(SERVICES.find((s) => s.value === service)?.label ?? 'ae.svc.registration');
  const canSubmit = !problem && (forMe || (consent && chosen.length > 0)) && (repeat === 'none' || !!until) && !saving;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      if (forMe) {
        const type = SERVICES.find((s) => s.value === service)?.type ?? 'vet_visit';
        for (const d of dates) await addLocalEvent({ title: serviceLabel, type, date: d, time: startTime });
        notify(t('ae.savedReminder'));
        router.back();
        return;
      }
      const span = spanDays(startDate, endDate);
      const series = dates.length > 1 ? `S-${Date.now().toString(36).toUpperCase()}` : undefined;
      const farmerName = user?.fullName ?? user?.email ?? 'Farmer';
      const vetName = chosenVet?.name ?? t('ae.ngarenSupport');
      const link = mode === 'onsite' ? '' : `https://meet.jit.si/ngaren-${Math.random().toString(36).slice(2, 10)}`;
      const labels = chosen.map((aan) => {
        const a = animalChoices.find((x) => x.aan === aan);
        return a?.name ? `${aan} · ${a.name}` : aan;
      });
      let firstId: string | undefined;
      for (let i = 0; i < dates.length; i += 1) {
        const id = await submitCalloutRequest({
          vetId: chosenVet?.id,
          vetName,
          vetUserId: chosenVet?.userId,
          farmerName,
          animal: labels.length === 1 ? labels[0] : t('ae.animalsCount', { count: labels.length }),
          animalTag: chosen[0],
          locationName: farm?.name ?? farm?.city ?? 'Farm',
          urgency,
          notes: [link ? `[Meeting link: ${link}]` : '', notes.trim()].filter(Boolean).join(' ') || undefined,
          mode,
          service,
          serviceCodes: serviceCode(service),
          scheduledFor: dates[i],
          scheduledSlot: slotText(startTime, endTime),
          endDate: span > 0 ? shiftDate(dates[i], span) : undefined,
          series: series ? `${series} (${i + 1} of ${dates.length})` : undefined,
          accessScope: allAnimals ? 'all-animals' : 'selected',
          accessAnimals: labels,
          records: service === 'Registration' ? chosen : undefined,
        });
        firstId = firstId ?? id;
      }
      // Registration hands the records to whoever takes the visit.
      if (service === 'Registration' && user) {
        await assignRecordsToVet({
          drafts: drafts.filter((d) => chosen.includes(d.aan)),
          animals: herd.filter((a) => !!a.ngarenCode && chosen.includes(a.ngarenCode) && !drafts.some((d) => d.aan === a.ngarenCode)),
          farmer: { id: user.id, name: farmerName },
          booking: { id: firstId, service: serviceLabel, mode, date: startDate, slot: slotText(startTime, endTime), meetingLink: link || undefined },
        });
      }
      notify(dates.length > 1 ? t('ae.bookedSeries', { count: dates.length }) : t('ae.booked'));
      router.back();
    } catch {
      Alert.alert(t('fv.sendFailedTitle'), t('fv.sendFailedBody'));
    } finally {
      setSaving(false);
    }
  };

  const VetRow = ({ v }: { v: Vet }) => {
    const on = invitee === String(v.id);
    const avail = availabilityOf(v);
    return (
      <Pressable
        onPress={() => setInvitee(String(v.id))}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: on ? colors.primary : colors.divider, backgroundColor: on ? colors.primaryTint : colors.surface, marginBottom: spacing.xs }}>
        <Icon name={on ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={on ? colors.primary : colors.onSurfaceVariant} />
        <View style={{ flex: 1 }}>
          <AppText variant="body" style={{ fontWeight: '600' }}>{v.name}</AppText>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {v.distanceKm > 0 ? t('ae.kmAway', { km: v.distanceKm }) : t('ae.distanceUnknown')}
          </AppText>
        </View>
        <AppText variant="caption" color={AVAIL_TINT[avail]} style={{ fontWeight: '700' }}>{t(`ae.avail.${avail}`)}</AppText>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('ae.bookTitle')} subtitle={t('ae.bookSubtitle')} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        {/* When — start and end, and whether it repeats. */}
        <DatePickerField label={t('ae.startDate')} required value={startDate} onSelect={setStartDate} />
        <PickerField label={t('ae.startTime')} required value={startTime} options={TIME_OPTIONS.map((v) => ({ label: v, value: v }))} onSelect={setStartTime} />
        <DatePickerField label={t('ae.endDate')} required value={endDate} onSelect={setEndDate} />
        <PickerField label={t('ae.endTime')} required value={endTime} options={TIME_OPTIONS.map((v) => ({ label: v, value: v }))} onSelect={setEndTime} />
        {problem === 'order' ? <AppText variant="caption" color={colors.error} style={{ marginTop: -spacing.sm, marginBottom: spacing.sm }}>{t('ae.endBeforeStart')}</AppText> : null}
        <Label text={t('ae.repeat')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }}>
          {REPEATS.map((r) => <Chip key={r} label={t(`ae.repeat.${r}`)} on={repeat === r} onPress={() => setRepeat(r)} />)}
        </View>
        {repeat !== 'none' ? (
          <>
            <DatePickerField label={t('ae.repeatUntil')} required value={until} onSelect={setUntil} />
            {until ? <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}>{t('ae.repeatCount', { count: dates.length })}</AppText> : null}
          </>
        ) : null}

        {/* Type of meeting (was "Title") and the service (was "Activity type"). */}
        <PickerField
          label={t('ae.meetingType')}
          required
          value={urgency}
          options={[{ label: t('urgency.routine'), value: 'Routine' }, { label: t('urgency.emergency'), value: 'Emergency' }]}
          onSelect={(v) => setUrgency(v as CalloutUrgency)}
        />
        <PickerField label={t('ae.serviceRequest')} required value={service} options={SERVICES.map((s) => ({ label: `${t(s.label)} · ${serviceCode(s.value)}`, value: s.value }))} onSelect={setService} />

        {/* Who is invited. */}
        <Label text={t('ae.invitee')} required />
        <Pressable
          onPress={() => setInvitee(NGAREN)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: invitee === NGAREN ? colors.primary : colors.divider, backgroundColor: invitee === NGAREN ? colors.primaryTint : colors.surface, marginBottom: spacing.xs }}>
          <Icon name={invitee === NGAREN ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={invitee === NGAREN ? colors.primary : colors.onSurfaceVariant} />
          <View style={{ flex: 1 }}>
            <AppText variant="body" style={{ fontWeight: '600' }}>{t('ae.ngarenSupport')}</AppText>
            <AppText variant="caption" color={colors.onSurfaceVariant}>{t('ae.ngarenSupportSub')}</AppText>
          </View>
        </Pressable>
        <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}>{t('ae.vetsInRange', { km })}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }}>
          {RADIUS_OPTIONS.map((r) => (
            <Chip key={r} label={`${r} km`} on={km === r} onPress={() => { setRadiusKm(r); void setNearbyRadiusKm(r); }} />
          ))}
        </View>
        {inRange.length === 0 ? <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.xs }}>{t('ae.noVetsInRange')}</AppText> : null}
        {inRange.map((v) => <VetRow key={v.id} v={v} />)}
        {unknownDistance.length > 0 ? (
          <>
            <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}>{t('ae.vetsNoDistance')}</AppText>
            {unknownDistance.map((v) => <VetRow key={v.id} v={v} />)}
          </>
        ) : null}
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>{t('ae.availNote')}</AppText>
        <Pressable onPress={() => setInvitee(ME)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, marginBottom: spacing.md }}>
          <Icon name={forMe ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={forMe ? colors.primary : colors.onSurfaceVariant} />
          <AppText variant="body">{t('ae.justMe')}</AppText>
        </Pressable>

        {!forMe ? (
          <>
            {/* How the meeting is held. */}
            <Label text={t('ae.meetingFormat')} required />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              {MODES.map((m) => {
                const on = mode === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setMode(m.key)}
                    style={{ flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.divider }}>
                    <Icon name={m.icon} size={20} color={on ? '#fff' : colors.onSurfaceVariant} />
                    <AppText variant="caption" color={on ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>{t(`fv.${m.key}`)}</AppText>
                  </Pressable>
                );
              })}
            </View>
            {service === 'Registration' && mode !== 'onsite' ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, backgroundColor: colors.warningTint, borderRadius: radius.md, padding: spacing.sm, marginTop: -spacing.sm, marginBottom: spacing.md }}>
                <Icon name="information-outline" size={16} color={colors.warning} />
                <AppText variant="caption" style={{ flex: 1 }}>{t('fv.onsiteRecommended')}</AppText>
              </View>
            ) : null}
            {mode !== 'onsite' ? (
              <Pressable onPress={() => Linking.openURL('https://meet.jit.si').catch(() => {})} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: -spacing.sm, marginBottom: spacing.md }}>
                <Icon name="video-outline" size={15} color={colors.primary} />
                <AppText variant="caption" color={colors.primary}>{t('ae.linkMade')}</AppText>
              </Pressable>
            ) : null}

            {/* The animals the farmer consents to having serviced. */}
            <Label text={t('ae.animals')} required />
            <Pressable onPress={() => setAllAnimals((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}>
              <Icon name={allAnimals ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={allAnimals ? colors.primary : colors.onSurfaceVariant} />
              <AppText variant="body" style={{ fontWeight: '600' }}>{t('ae.allAnimals', { count: animalChoices.length })}</AppText>
            </Pressable>
            {!allAnimals
              ? animalChoices.map((a) => {
                  const on = aans.includes(a.aan);
                  return (
                    <Pressable key={a.aan} onPress={() => toggle(a.aan)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}>
                      <Icon name={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={on ? colors.primary : colors.onSurfaceVariant} />
                      <AppText variant="body" style={{ flex: 1 }}>{a.name ? `${a.aan} · ${a.name}` : a.aan}</AppText>
                      {a.draft ? <AppText variant="caption" color={colors.warning}>{t('fv.recordIncompleteTag')}</AppText> : null}
                    </Pressable>
                  );
                })
              : null}
            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>{t('ae.animalsChosen', { count: chosen.length })}</AppText>
          </>
        ) : null}

        <TextField label={t('ad.notes')} value={notes} onChangeText={setNotes} placeholder={t('fv.notesPlaceholder')} multiline />

        {!forMe ? (
          <Pressable onPress={() => setConsent((v) => !v)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md }}>
            <Icon name={consent ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={consent ? colors.primary : colors.onSurfaceVariant} />
            <AppText variant="body" style={{ flex: 1 }}>{t('ae.consent')}</AppText>
          </Pressable>
        ) : null}

        <Button
          label={forMe ? t('ae.addBtn') : dates.length > 1 ? t('ae.sendSeries', { count: dates.length }) : t('ae.send')}
          icon={forMe ? 'calendar-plus' : 'send-outline'}
          loading={saving}
          disabled={!canSubmit}
          onPress={onSubmit}
        />
      </Screen>
    </View>
  );
}
