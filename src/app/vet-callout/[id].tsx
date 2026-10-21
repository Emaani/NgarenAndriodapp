import { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { colors, radius, shadow, spacing } from '@/theme';
import { calloutRequests as calloutFallback } from '@/data/mock';
import { getCalloutRequests, updateCalloutStatus } from '@/data/api';
import { addFollowUp, FollowUpKind } from '@/data/followUps';
import { addLocalNotification } from '@/data/localNotifications';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { notify } from '@/lib/toast';
import { sendLocalNotification } from '@/services/push';
import { CalloutRequest, CalloutStatus } from '@/data/types';
import { useT, useTStatus } from '@/i18n';
import { ActionChip, AppText, BottomSheet, Button, DatePickerField, DetailRow, EmptyState, GradientHeader, Icon, IconName, PhotoField, Screen, TextField } from '@/ui';

/** An on-site task activation: live photo + best-effort GPS + timestamp. */
interface TaskStamp {
  photo: string;
  at: string;
  lat?: number;
  lng?: number;
}

/** Short HH:MM from an ISO string (Hermes-safe, no Intl). */
function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const statusVariant = (s: CalloutStatus) =>
  s === 'accepted' ? 'success' : s === 'completed' ? 'info' : s === 'declined' ? 'error' : 'warning';

// The on-site service actions a vet performs (Sep 3 2026 MVP scope).
const SERVICES: { key: string; labelKey: string; icon: IconName; route: (animal: string) => string }[] = [
  { key: 'stock', labelKey: 'vp.svStockTake', icon: 'clipboard-list-outline', route: () => '/stock-take' },
  { key: 'vaccination', labelKey: 'vp.svVaccination', icon: 'needle', route: (a) => `/add-health-record?animal=${encodeURIComponent(a)}&label=${encodeURIComponent(a)}&type=vaccination` },
  { key: 'treatment', labelKey: 'vp.svTreatment', icon: 'medical-bag', route: (a) => `/add-health-record?animal=${encodeURIComponent(a)}&label=${encodeURIComponent(a)}&type=treatment` },
  { key: 'consultation', labelKey: 'vp.svConsultation', icon: 'comment-question-outline', route: (a) => `/add-health-record?animal=${encodeURIComponent(a)}&label=${encodeURIComponent(a)}&type=consultation` },
];

/**
 * Vet call-out response — how a vet acts on a farmer's request: accept/decline,
 * then (once on-site) verify presence with a live photo to unlock the service
 * actions (stock-take / vaccination / treatment / consultation), and complete.
 * Records access is scoped to the appointment window (time-limited).
 */
export default function VetCallout() {
  const router = useRouter();
  const tr = useT();
  const tStatus = useTStatus();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, isAuthenticated, canVet, user } = useAuth();
  const { data: requests } = useResource(() => getCalloutRequests(), calloutFallback);

  const req: CalloutRequest | undefined = requests.find((r) => r.id === Number(id));
  const [status, setStatus] = useState<CalloutStatus | null>(null);
  // Follow-up booking (Log Visit rework, Oct 20 2026) — tied to this meeting's
  // animal; the farmer must accept before it hits the calendar.
  const [fuSheet, setFuSheet] = useState(false);
  const [fuKind, setFuKind] = useState<FollowUpKind>('vaccination');
  const [fuDate, setFuDate] = useState('');
  const [fuNote, setFuNote] = useState('');
  const [fuBusy, setFuBusy] = useState(false);
  // Per-task on-site activation (Sep 12 2026): each service task is activated
  // individually with a live Face-ID photo, stamped with GPS location + time so
  // the on-site check is genuinely accountable (not just a photo).
  const [activated, setActivated] = useState<Record<string, TaskStamp>>({});
  const [activeCapture, setActiveCapture] = useState<string | null>(null);

  // Capture a live photo + best-effort GPS + timestamp as the activation stamp.
  const activateTask = async (key: string, label: string, photo: string) => {
    const at = new Date().toISOString();
    setActivated((prev) => ({ ...prev, [key]: { photo, at } }));
    setActiveCapture(null);
    notify(tr('vc.activatedToast', { label }));
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setActivated((prev) => ({ ...prev, [key]: { ...(prev[key] ?? { photo, at }), lat: pos.coords.latitude, lng: pos.coords.longitude } }));
    } catch {
      // GPS best-effort — the photo + time still stand.
    }
  };

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!canVet) return <Redirect href="/(tabs)/home" />;

  if (!req) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title={tr('vc.title')} showBack />
        <EmptyState icon="clipboard-pulse-outline" title={tr('vc.notFoundTitle')} subtitle={tr('vc.notFoundSub')} />
      </View>
    );
  }

  const current = status ?? req.status;
  // Reveal-on-accept: farmer identity & exact location stay hidden until the
  // vet accepts (Sep 5 2026 anonymized vet view).
  const revealed = current !== 'pending';

  // On-site tasks the vet can activate individually (Sep 12 2026). The Visit
  // Scorecard is the comprehensive record; the others jump to focused screens.
  const wantsAi = !!req && (req.service ?? '').toLowerCase().includes('insemination');
  const TASKS: { key: string; label: string; icon: IconName; route: string }[] = req
    ? [
        { key: 'scorecard', label: tr('vc.visitScorecard'), icon: 'clipboard-plus-outline', route: `/vet-scorecard/new?key=${encodeURIComponent(req.animal)}&label=${encodeURIComponent(req.animal)}&callout=${req.id}` },
        ...SERVICES.map((s) => ({ key: s.key, label: tr(s.labelKey), icon: s.icon, route: s.route(req.animal) })),
        ...(wantsAi
          ? [{ key: 'ai', label: tr('vc.svAi'), icon: 'dna' as IconName, route: `/ai-template?key=${encodeURIComponent(req.animal)}&label=${encodeURIComponent(req.animal)}&callout=${req.id}` }]
          : []),
      ]
    : [];

  const setAndSync = (next: CalloutStatus, toast: string) => {
    setStatus(next);
    updateCalloutStatus(req.id, next).catch(() => undefined);
    notify(toast);
    if (next === 'accepted') {
      void sendLocalNotification(tr('vc.notifTitle'), tr('vc.notifBody', { farmer: req.farmerName, animal: req.animal }), { type: 'VET_CALLOUT' });
    }
  };

  const bookFollowUp = async () => {
    if (!req || !fuDate) return;
    setFuBusy(true);
    try {
      const vetName = user?.fullName ?? user?.email ?? 'Vet';
      await addFollowUp({
        aan: req.animal,
        animalLabel: req.animal,
        kind: fuKind,
        date: fuDate,
        note: fuNote.trim() || null,
        vetId: user?.id ?? null,
        vetName,
        farmerName: req.farmerName,
      });
      // Invite the farmer — it only hits the calendar once they accept.
      void addLocalNotification({
        title: 'Follow-up invitation',
        message: `${vetName} proposed a ${fuKind} follow-up for ${req.animal}. Review and accept it in Follow-ups.`,
      });
      void sendLocalNotification(tr('vc.fuSentTitle'), tr('vc.fuSentBody', { animal: req.animal }), { type: 'FOLLOWUP_INVITE' });
      setFuSheet(false);
      setFuDate('');
      setFuNote('');
      notify(tr('vc.fuSentToast'));
    } finally {
      setFuBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={tr('vc.title')} subtitle={req.animal} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        {/* Summary */}
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
          <View style={{ width: 46, height: 46, borderRadius: radius.full, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={revealed ? 'account-outline' : 'account-lock-outline'} size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>
              {revealed ? req.farmerName : tr('vc.farmerHidden')}
            </AppText>
            <AppText variant="caption" color={colors.onSurfaceVariant}>
              {revealed ? tr('vc.revealedMeta', { loc: req.locationName, km: req.distanceKm, time: req.requestedAt }) : tr('vc.hiddenMeta', { km: req.distanceKm, time: req.requestedAt })}
            </AppText>
          </View>
          <ActionChip label={tStatus(current)} variant={statusVariant(current)} />
        </View>

        {/* Request details */}
        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          {tr('vc.request')}
        </AppText>
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, marginBottom: spacing.lg }, shadow[1]]}>
          <DetailRow label={tr('ad.animalTitle')} value={req.animal} />
          <DetailRow label={tr('vrq.priority')} value={tr(`urgency.${req.urgency.toLowerCase()}`)} />
          <DetailRow label="SLA" value={req.urgency === 'Emergency' ? tr('vc.sla4') : tr('vc.sla48')} />
          <DetailRow label={tr('vc.farmer')} value={revealed ? req.farmerName : tr('vc.hiddenUntil')} />
          <DetailRow label={tr('ad.location')} value={revealed ? `${req.locationName} · ${req.distanceKm} km` : tr('vc.locHidden', { km: req.distanceKm })} last={!req.notes} />
          {req.notes ? <DetailRow label={tr('ad.notes')} value={req.notes} last /> : null}
        </View>

        {/* Accountability through the deliverable, not a hard clock (Oct 2026
            standup — strict time limits removed for MVP1). */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }}>
          <Icon name="shield-check-outline" size={18} color={colors.primary} />
          <AppText variant="caption" color={colors.primary} style={{ flex: 1, fontWeight: '600' }}>
            {tr('vc.accountability')}
          </AppText>
        </View>

        {/* Status-driven actions */}
        {current === 'pending' ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button label={tr('vet.decline')} variant="outline" onPress={() => setAndSync('declined', tr('vc.declinedToast'))} style={{ flex: 1 }} />
            <Button label={tr('vet.accept')} icon="check" onPress={() => setAndSync('accepted', tr('vc.acceptedToast'))} style={{ flex: 1 }} />
          </View>
        ) : null}

        {current === 'declined' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.errorTint, borderRadius: radius.md, padding: spacing.md }}>
            <Icon name="close-circle-outline" size={18} color={colors.error} />
            <AppText variant="caption" color={colors.error} style={{ flex: 1, fontWeight: '600' }}>
              {tr('vc.declinedNote')}
            </AppText>
          </View>
        ) : null}

        {current === 'accepted' ? (
          <>
            <AppText variant="title" style={{ marginBottom: spacing.xs }}>
              {tr('vc.onSiteActivation')}
            </AppText>
            {/* 45-minute activation window from the scheduled time (Sep 12 2026). */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
              <Icon name="clock-alert-outline" size={18} color={colors.primary} />
              <AppText variant="caption" color={colors.primary} style={{ flex: 1, fontWeight: '600' }}>
                {tr('vc.activateHint')}
              </AppText>
            </View>

            <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
              {TASKS.map((t) => {
                const isActive = !!activated[t.key];
                const capturing = activeCapture === t.key;
                return (
                  <View key={t.key} style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: isActive ? colors.success : colors.divider, gap: spacing.sm }, shadow[1]]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <View style={{ width: 34, height: 34, borderRadius: radius.full, backgroundColor: isActive ? colors.successTint : colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name={t.icon} size={18} color={isActive ? colors.success : colors.primary} />
                      </View>
                      <AppText variant="bodyLarge" style={{ fontWeight: '700', flex: 1 }}>
                        {t.label}
                      </AppText>
                      {isActive ? <Icon name="check-decagram" size={20} color={colors.success} /> : <Icon name="face-recognition" size={20} color={colors.onSurfaceVariant} />}
                    </View>

                    {isActive ? (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                          <Icon name="map-marker-check-outline" size={13} color={colors.success} />
                          <AppText variant="caption" color={colors.success} style={{ fontWeight: '600' }}>
                            {activated[t.key].lat != null
                              ? tr('vc.verifiedGps', { time: hhmm(activated[t.key].at), lat: activated[t.key].lat!.toFixed(4), lng: activated[t.key].lng!.toFixed(4) })
                              : tr('vc.verifiedNoGps', { time: hhmm(activated[t.key].at) })}
                          </AppText>
                        </View>
                        <Button label={tr('vc.open', { label: t.label })} icon={t.icon} onPress={() => router.push(t.route as never)} />
                      </>
                    ) : capturing ? (
                      <>
                        <AppText variant="caption" color={colors.onSurfaceVariant}>
                          {tr('vc.faceHint')}
                        </AppText>
                        <PhotoField
                          label={tr('vc.faceId')}
                          value={null}
                          onChange={(uri) => {
                            if (uri) void activateTask(t.key, t.label, uri);
                          }}
                          liveOnly
                        />
                        <Button label={tr('common.cancel')} variant="outline" onPress={() => setActiveCapture(null)} />
                      </>
                    ) : (
                      <Button label={tr('vc.activateFace')} icon="face-recognition" variant="outline" onPress={() => setActiveCapture(t.key)} />
                    )}
                  </View>
                );
              })}
            </View>

            {/* Unregistered-animal capture (Oct 2026 standup): the vet can
                register an animal found on-site; it goes for admin + farmer
                approval before its records are finalized. */}
            <Button
              label={tr('common.regNewAnimal')}
              icon="plus-circle-outline"
              variant="outline"
              onPress={() => router.push('/register-animal' as never)}
              style={{ marginBottom: spacing.sm }}
            />

            {/* Book a vaccination/treatment follow-up for THIS animal; the farmer
                accepts it before it is scheduled (Log Visit rework). */}
            <Button
              label={tr('vc.bookFollowUp')}
              icon="calendar-plus"
              variant="outline"
              onPress={() => setFuSheet(true)}
              style={{ marginBottom: spacing.sm }}
            />

            <Button
              label={tr('vc.completeVisit')}
              icon="check-decagram-outline"
              disabled={Object.keys(activated).length === 0}
              onPress={() => setAndSync('completed', tr('vc.completedToast'))}
            />
            {Object.keys(activated).length === 0 ? (
              <AppText variant="caption" color={colors.onSurfaceVariant} style={{ textAlign: 'center', marginTop: spacing.xs }}>
                {tr('vc.activateFirst')}
              </AppText>
            ) : null}
          </>
        ) : null}

        {current === 'completed' ? (
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#0EA5E91A', borderRadius: radius.md, padding: spacing.md }}>
              <Icon name="check-decagram" size={18} color="#0EA5E9" />
              <AppText variant="caption" color="#0369A1" style={{ flex: 1, fontWeight: '600' }}>
                {tr('vc.completedNote')}
              </AppText>
            </View>
            <Button label={tr('vc.bookFollowUp')} icon="calendar-plus" variant="outline" onPress={() => setFuSheet(true)} />
          </View>
        ) : null}
      </Screen>

      {/* Follow-up booking sheet — vaccination/treatment recheck for this AAN. */}
      <BottomSheet visible={fuSheet} onClose={() => setFuSheet(false)} title={tr('vc.bookFollowUp')}>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          {tr('vc.fuIntro', { animal: req.animal })}
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm }}>
          {(['vaccination', 'treatment'] as FollowUpKind[]).map((k) => {
            const on = fuKind === k;
            return (
              <Button
                key={k}
                label={k === 'vaccination' ? tr('vc.fuVaccination') : tr('vc.fuTreatment')}
                variant={on ? 'primary' : 'outline'}
                icon={k === 'vaccination' ? 'needle' : 'medical-bag'}
                onPress={() => setFuKind(k)}
                style={{ flex: 1 }}
              />
            );
          })}
        </View>
        <DatePickerField label={tr('vc.fuDate')} value={fuDate} placeholder={tr('vc.fuDatePick')} onSelect={setFuDate} />
        <TextField label={tr('vc.fuNote')} value={fuNote} onChangeText={setFuNote} placeholder={tr('vc.fuNotePlaceholder')} multiline />
        <Button label={tr('vc.fuSend')} icon="send-outline" loading={fuBusy} disabled={!fuDate || fuBusy} onPress={bookFollowUp} style={{ marginTop: spacing.sm }} />
      </BottomSheet>
    </View>
  );
}
