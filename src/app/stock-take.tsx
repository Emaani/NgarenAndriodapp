import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { animals as animalsFallback } from '@/data/mock';
import { getHerd } from '@/data/herd';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { sendLocalNotification } from '@/services/push';
import { addAbsenceReports, saveStockTakeResult, StockTakeAbsence } from '@/data/localStockTake';
import { addLocalEvent } from '@/data/localEvents';
import { persistImage } from '@/lib/photos';
import { ageFromDate, formatDateTime } from '@/lib/date';
import { normalizeBleMac } from '@/lib/bleFrame';
import { isBleDeviceType } from '@/lib/bleResolve';
import { Animal } from '@/data/types';
import { useT } from '@/i18n';
import { AnimalPhoto, AppText, BottomSheet, Button, DetailRow, GradientHeader, Icon, IconChip, IconName, Screen } from '@/ui';

/** The AAN / reference identifier used to list an animal in reports. */
const aanOf = (a: Animal): string => a.ngarenCode ?? a.accountNumber ?? a.tag;

type Mark = 'pending' | 'present' | 'missing';
type Phase = 'method' | 'count' | 'summary';
// Oct 2026 standup: "photo confirmation" and "manual/visual" are combined into a
// single manual & visual identification method (photos + descriptors). Photo is
// strict evidence — an animal not confirmed with a photo is recorded as missing.
type StockMethod = 'manual_visual' | 'bluetooth' | 'qr';

const METHODS: { value: StockMethod; icon: IconName; title: string; blurb: string }[] = [
  { value: 'manual_visual', icon: 'camera-outline', title: 'stock.mvTitle', blurb: 'stock.mvBlurb' },
  { value: 'bluetooth', icon: 'bluetooth', title: 'stock.bleTitle', blurb: 'stock.bleBlurb' },
  { value: 'qr', icon: 'qrcode-scan', title: 'stock.qrTitle', blurb: 'stock.qrBlurb' },
];

function ProgressBar({ value }: { value: number }) {
  return (
    <View
      style={{
        height: 8,
        borderRadius: radius.full,
        backgroundColor: 'rgba(255,255,255,0.3)',
        overflow: 'hidden',
      }}>
      <View
        style={{
          width: `${Math.round(value * 100)}%`,
          height: '100%',
          borderRadius: radius.full,
          backgroundColor: '#fff',
        }}
      />
    </View>
  );
}

function MarkButton({
  label,
  icon,
  active,
  activeColor,
  onPress,
}: {
  label: string;
  icon: 'check' | 'close';
  active: boolean;
  activeColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        backgroundColor: active ? activeColor : colors.background,
        borderWidth: 1,
        borderColor: active ? activeColor : colors.divider,
      }}>
      <Icon name={icon} size={16} color={active ? '#fff' : colors.onSurfaceVariant} />
      <AppText variant="body" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function AnimalRow({
  animal,
  mark,
  onMark,
  photoMode,
  photoUri,
  onCapture,
}: {
  animal: Animal;
  mark: Mark;
  onMark: (m: Mark) => void;
  photoMode?: boolean;
  photoUri?: string;
  onCapture?: () => void;
}) {
  const t = useT();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: spacing.md,
          gap: spacing.mdMinus,
          marginBottom: spacing.mdMinus,
          borderWidth: 1,
          borderColor: colors.divider,
        },
        shadow[1],
      ]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus }}>
        <AnimalPhoto uri={photoUri} size={38} rounded={radius.sm} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
            {animal.name ?? animal.tag}
          </AppText>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {animal.tag} · {animal.locationName ?? '—'}
          </AppText>
        </View>
        {mark === 'present' && <Icon name="check-circle" size={22} color={colors.success} />}
        {mark === 'missing' && <Icon name="alert-circle" size={22} color={colors.error} />}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {/* Photo mode: confirming presence requires a current picture. */}
        {photoMode && mark !== 'present' ? (
          <MarkButton label={t('stock.photoToConfirm')} icon="check" active={false} activeColor={colors.success} onPress={() => onCapture?.()} />
        ) : (
          <MarkButton
            label={t('stock.present')}
            icon="check"
            active={mark === 'present'}
            activeColor={colors.success}
            onPress={() => onMark(mark === 'present' ? 'pending' : 'present')}
          />
        )}
        <MarkButton
          label={t('stock.absent')}
          icon="close"
          active={mark === 'missing'}
          activeColor={colors.error}
          onPress={() => onMark(mark === 'missing' ? 'pending' : 'missing')}
        />
      </View>
    </View>
  );
}

function SummaryStat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={[{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
      <AppText variant="display" color={color}>
        {value}
      </AppText>
      <AppText variant="caption" color={colors.onSurfaceVariant}>
        {label}
      </AppText>
    </View>
  );
}

export default function StockTake() {
  const router = useRouter();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { can, canVet, user } = useAuth();
  const { data: allAnimals } = useResource(getHerd, animalsFallback);
  const [marks, setMarks] = useState<Record<number, Mark>>(() =>
    Object.fromEntries(animalsFallback.map((a) => [a.id, 'pending' as Mark])),
  );
  const [phase, setPhase] = useState<Phase>('method');
  const [method, setMethod] = useState<StockMethod>('manual_visual');
  // Confirmation photos captured in photo mode, keyed by animal id.
  const [photos, setPhotos] = useState<Record<number, string>>({});
  // The animal whose photo-confirmation sheet is currently open (null = none).
  // Tapping "Photo to confirm" opens a brief identity sheet first so the person
  // verifies they are photographing the right animal (strict visual evidence).
  const [confirmAnimal, setConfirmAnimal] = useState<Animal | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Add any newly-loaded animals to the count sheet as pending.
  useEffect(() => {
    setMarks((prev) => {
      const next = { ...prev };
      for (const a of allAnimals) if (!(a.id in next)) next[a.id] = 'pending';
      return next;
    });
  }, [allAnimals]);

  const counted = useMemo(
    () => allAnimals.filter((a) => marks[a.id] !== 'pending').length,
    [marks, allAnimals],
  );
  const present = useMemo(
    () => allAnimals.filter((a) => marks[a.id] === 'present').length,
    [marks, allAnimals],
  );
  const missing = useMemo(
    () => allAnimals.filter((a) => marks[a.id] === 'missing').length,
    [marks, allAnimals],
  );
  const notCounted = allAnimals.length - counted;
  const progress = allAnimals.length ? counted / allAnimals.length : 0;

  const setMark = (id: number, m: Mark) => setMarks((prev) => ({ ...prev, [id]: m }));

  // Photo mode: taking a current picture is what confirms presence. Robust with
  // explicit feedback — a silent failure (e.g. a previously-denied camera
  // permission) is exactly what made this feel "available but not functional".
  const captureFor = async (id: number) => {
    setCapturing(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('stock.cameraNeededTitle'), t('stock.cameraNeededBody'));
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.5, allowsEditing: false });
      if (!res.canceled && res.assets?.[0]) {
        setPhotos((prev) => ({ ...prev, [id]: persistImage(res.assets[0].uri) ?? res.assets[0].uri }));
        setMark(id, 'present');
        setConfirmAnimal(null);
      }
    } catch {
      Alert.alert(t('stock.cameraErrTitle'), t('stock.cameraErrBody'));
    } finally {
      setCapturing(false);
    }
  };
  // Finalise the stock take (Oct 2026 Q&A): submission succeeds only after a
  // live facial identification of the registered user, and any animal marked
  // absent triggers an escalation to Ngaren Admin / the farmer / set contacts.
  const submitStockTake = async () => {
    setSubmitting(true);
    try {
      const strict = method === 'manual_visual';
      // Visual stocktaking confirms each animal with a live CAMERA photo, so the
      // submit does NOT require a facial-recognition selfie (Oct 20 2026 spec).
      // Device-based rounds (BLE / QR) still verify the registered user with a
      // front-camera Face ID, since they have no per-animal photo evidence.
      if (!strict) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t('stock.faceIdTitle'), t('stock.faceIdNeeded'));
          return;
        }
        const shot = await ImagePicker.launchCameraAsync({ quality: 0.4, cameraType: ImagePicker.CameraType.front });
        if (shot.canceled || !shot.assets?.[0]) {
          Alert.alert(t('stock.faceIdTitle'), t('stock.faceIdRequired'));
          return;
        }
      }
      // Escalate absent animals.
      const absent = allAnimals.filter(
        (a) => marks[a.id] === 'missing' || (strict && (marks[a.id] ?? 'pending') === 'pending'),
      );
      const presentCount = allAnimals.filter((a) => marks[a.id] === 'present').length;
      const nowIso = new Date().toISOString();
      const reportedBy = user?.fullName ?? user?.email ?? 'Stock-taker';
      // Persist the result so the farmer dashboard can show the latest count.
      await saveStockTakeResult({
        date: nowIso,
        present: presentCount,
        absent: absent.length,
        total: allAnimals.length,
        method,
      });
      // Persist a follow-up report per absent animal — by AAN, date & user.
      const absenceReports: StockTakeAbsence[] = absent.map((a) => ({
        id: `abs-${a.id}-${Date.now()}`,
        aan: aanOf(a),
        animalLabel: a.name ?? a.tag,
        locationName: a.locationName ?? null,
        date: nowIso,
        reportedBy,
      }));
      await addAbsenceReports(absenceReports);
      // Log the stock-take on the shared calendar so it is visible and managed
      // consistently across profiles (farmer + vet) — Oct 2026 Q&A.
      const hhmm = nowIso.slice(11, 16);
      await addLocalEvent({
        title: t('stock.calendarTitle', { present: presentCount, absent: absent.length }),
        type: 'stock_take',
        date: nowIso.slice(0, 10),
        time: hhmm,
      });
      if (absent.length > 0) {
        const names = absent.slice(0, 5).map((a) => a.name ?? a.tag).join(', ');
        void sendLocalNotification(
          t('stock.escalationTitle'),
          t('stock.escalationBody', { count: absent.length, names: names + (absent.length > 5 ? '…' : '') }),
          { type: 'STOCKTAKE_ABSENT', count: absent.length },
        );
      }
      Alert.alert(
        t('stock.submittedTitle'),
        absent.length > 0 ? t('stock.submittedEscalated', { count: absent.length }) : t('stock.submittedOk'),
      );
      router.replace('/(tabs)/home');
    } catch {
      Alert.alert(t('stock.cameraErrTitle'), t('stock.cameraErrBody'));
    } finally {
      setSubmitting(false);
    }
  };

  // BLE: only animals bound to a BLE tag's STATIC MAC can be heard in a BLE
  // round (ELA, Oct 2026) — a satellite serial must never count as a BLE read.
  // Marks those animals present in one pass (the round's "acceptance" step).
  const bleAnimalIds = useMemo(() => {
    const ids = new Set<number>();
    for (const a of allAnimals) {
      const hasMac = (a.devices ?? []).some((d) => !!normalizeBleMac(d.bleMac ?? (isBleDeviceType(d.type) ? d.serial : null)));
      if (hasMac) ids.add(a.id);
    }
    return ids;
  }, [allAnimals]);
  const associateBleTags = () => {
    if (bleAnimalIds.size === 0) {
      Alert.alert(t('stock.bleNoneTitle'), t('stock.bleNoneBody'));
      return;
    }
    setMarks((prev) => {
      const next = { ...prev };
      for (const a of allAnimals) {
        if (bleAnimalIds.has(a.id) && a.status === 'active' && next[a.id] === 'pending') next[a.id] = 'present';
      }
      return next;
    });
  };

  // QR: mark the next uncounted animal present, simulating scanning one tag.
  const scanNextTag = () => {
    const nextPending = allAnimals.find((a) => (marks[a.id] ?? 'pending') === 'pending');
    if (nextPending) setMark(nextPending.id, 'present');
  };

  const activeMethod = METHODS.find((m) => m.value === method)!;

  // Defence in depth: a delegated member without stock-take rights can't reach
  // this even via a deep link (the dashboard action is already hidden).
  // Vets (and admins, via canVet) perform stock-takes as a service; farmers/
  // delegates need the stock_take permission. Without this, the vet tab bounced
  // back to the dashboard ("nothing happens").
  if (!can('stock_take') && !canVet) return <Redirect href="/(tabs)/home" />;

  // Step 1 — choose how this herd is tagged before counting.
  if (phase === 'method') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title={t('action.stockTake')} subtitle={t('stock.methodSubtitle')} showBack />
        <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl + 72 + insets.bottom }}>
          <AppText variant="body" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
            {t('stock.intro')}
          </AppText>
          {METHODS.map((m) => {
            const selected = method === m.value;
            return (
              <Pressable
                key={m.value}
                onPress={() => setMethod(m.value)}
                style={[
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    padding: spacing.md,
                    marginBottom: spacing.sm,
                    borderRadius: radius.md,
                    backgroundColor: colors.surface,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? colors.primary : colors.divider,
                  },
                  shadow[1],
                ]}>
                <IconChip
                  icon={m.icon}
                  bg={selected ? colors.primaryTint : colors.background}
                  fg={selected ? colors.primary : colors.onSurfaceVariant}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                    {t(m.title)}
                  </AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    {t(m.blurb)}
                  </AppText>
                </View>
                {selected && <Icon name="check-circle" size={22} color={colors.primary} />}
              </Pressable>
            );
          })}
        </Screen>
        {/* Sticky, safe-area-aware footer so "Start count" is always reachable
            and never hidden below the phone edge (Oct 20 2026 spec). */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.divider,
          }}>
          <Button label={t('stock.startCount')} icon="arrow-right" onPress={() => setPhase('count')} />
        </View>
      </View>
    );
  }

  if (phase === 'summary') {
    // Strict photo-evidence (Oct 2026 standup): in manual & visual mode, any
    // animal not confirmed with a photo (still pending) counts as missing.
    const strict = method === 'manual_visual';
    const missingAnimals = allAnimals.filter(
      (a) => marks[a.id] === 'missing' || (strict && (marks[a.id] ?? 'pending') === 'pending'),
    );
    const missingCount = missingAnimals.length;
    const notCountedCount = strict ? 0 : notCounted;
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title={t('stock.reportTitle')} subtitle={t('stock.reportSubtitle')} showBack />
        <Screen contentStyle={{ paddingTop: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            <SummaryStat value={present} label={t('stock.present')} color={colors.success} />
            <SummaryStat value={missingCount} label={t('stock.missing')} color={colors.error} />
            <SummaryStat value={notCountedCount} label={t('stock.notCounted')} color={colors.onSurfaceVariant} />
          </View>

          {missingAnimals.length > 0 && (
            <>
              <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
                {t('stock.followUpList')}
              </AppText>
              {missingAnimals.map((a) => (
                <View
                  key={a.id}
                  style={[
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.mdMinus,
                      backgroundColor: colors.surface,
                      borderRadius: radius.md,
                      padding: spacing.md,
                      marginBottom: spacing.sm,
                      borderWidth: 1,
                      borderColor: colors.divider,
                    },
                    shadow[1],
                  ]}>
                  <IconChip icon="cow" bg={colors.errorTint} fg={colors.error} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                      {a.name ?? a.tag}
                    </AppText>
                    {/* Follow-up report: AAN · date of reported absence · user. */}
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      {t('stock.absenceAan', { aan: aanOf(a) })}
                    </AppText>
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      {t('stock.absenceMeta', { date: formatDateTime(new Date().toISOString()), by: user?.fullName ?? user?.email ?? 'Stock-taker' })}
                    </AppText>
                  </View>
                  <Pressable onPress={() => router.push('/(tabs)/track')} hitSlop={8}>
                    <Icon name="map-marker-radius" size={22} color={colors.primary} />
                  </Pressable>
                </View>
              ))}
            </>
          )}

          {/* Submission requires a live facial ID of the registered user; absent
              animals escalate on submit (Oct 2026 Q&A). */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginTop: spacing.md, marginBottom: spacing.sm }}>
            <Icon name="face-recognition" size={15} color={colors.primary} />
            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ flex: 1 }}>
              {missingCount > 0 ? t('stock.submitNoteEscalate', { count: missingCount }) : t('stock.submitNote')}
            </AppText>
          </View>
          <Button
            label={t('stock.submit')}
            icon="face-recognition"
            loading={submitting}
            onPress={submitStockTake}
          />
          <Button
            label={t('stock.backToCount')}
            variant="outline"
            disabled={submitting}
            onPress={() => setPhase('count')}
            style={{ marginTop: spacing.sm }}
          />
        </Screen>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('action.stockTake')} subtitle={t('stock.countSubtitle')} showBack>
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="body" color="rgba(255,255,255,0.92)">
              {t('stock.counted', { counted, total: allAnimals.length })}
            </AppText>
            <AppText variant="body" color="#fff" style={{ fontWeight: '600' }}>
              {t('stock.presentMissing', { present, missing })}
            </AppText>
          </View>
          <ProgressBar value={progress} />
        </View>
      </GradientHeader>

      {/* Method banner + the method's primary scan/associate action. */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm }}>
        <Pressable
          onPress={() => setPhase('method')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Icon name={activeMethod.icon} size={16} color={colors.primary} />
          <AppText variant="body" color={colors.primary} style={{ fontWeight: '600' }}>
            {t(activeMethod.title)}
          </AppText>
          <Icon name="pencil-outline" size={13} color={colors.onSurfaceVariant} />
        </Pressable>

        {method === 'bluetooth' && (
          <Button label={t('stock.scanBle')} icon="bluetooth" variant="outline" onPress={associateBleTags} />
        )}
        {method === 'qr' && (
          <Button label={t('stock.scanQr')} icon="qrcode-scan" variant="outline" onPress={scanNextTag} />
        )}
        {method === 'manual_visual' && (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, backgroundColor: colors.warningTint, borderRadius: radius.md, padding: spacing.sm }}>
            <Icon name="shield-alert-outline" size={15} color={colors.warning} />
            <AppText variant="caption" color={colors.onSurface} style={{ flex: 1 }}>
              {t('stock.strictEvidence')}
            </AppText>
          </View>
        )}
      </View>

      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl + 72 + insets.bottom }}>
        {allAnimals.map((a) => (
          <AnimalRow
            key={a.id}
            animal={a}
            mark={marks[a.id] ?? 'pending'}
            onMark={(m) => setMark(a.id, m)}
            photoMode={method === 'manual_visual'}
            photoUri={photos[a.id]}
            onCapture={() => setConfirmAnimal(a)}
          />
        ))}
      </Screen>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          // Clear the system nav bar / home indicator so the button is never
          // cut off below the phone edge (Oct 20 2026 spec).
          paddingBottom: insets.bottom + spacing.md,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.divider,
        }}>
        <Button
          label={notCounted > 0 ? t('stock.reviewN', { count: notCounted }) : t('stock.review')}
          icon="clipboard-check-outline"
          onPress={() => setPhase('summary')}
        />
      </View>

      {/* Photo-confirmation sheet — brief animal identity + reference Photo ID
          so the person confirms the animal before capturing the live evidence
          photo (strict visual identification, Oct 2026 standup). */}
      <BottomSheet
        visible={confirmAnimal !== null}
        onClose={() => setConfirmAnimal(null)}
        title={t('stock.confirmTitle')}>
        {confirmAnimal ? (
          <View style={{ gap: spacing.md }}>
            <AppText variant="body" color={colors.onSurfaceVariant}>
              {t('stock.confirmIntro')}
            </AppText>

            {/* Reference Photo ID (if the animal has one) to match against. */}
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <AnimalPhoto uri={confirmAnimal.photos?.[0] ?? confirmAnimal.onboardingPhotos?.[0]} size={72} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>
                  {confirmAnimal.name ?? confirmAnimal.tag}
                </AppText>
                <AppText variant="caption" color={colors.onSurfaceVariant}>
                  {confirmAnimal.photos?.[0] || confirmAnimal.onboardingPhotos?.[0] ? t('stock.photoRef') : t('stock.noRefPhoto')}
                </AppText>
              </View>
            </View>

            {/* Brief animal details. */}
            <View style={[{ backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>
              <DetailRow label={t('ad.farmerRef')} value={confirmAnimal.accountNumber ?? confirmAnimal.tag} />
              <DetailRow label={t('ad.breed')} value={confirmAnimal.breed.name} />
              {confirmAnimal.color ? <DetailRow label={t('ad.colour')} value={confirmAnimal.color} /> : null}
              <DetailRow label={t('ad.age')} value={ageFromDate(confirmAnimal.dateOfBirth)} />
              <DetailRow label={t('ad.location')} value={confirmAnimal.locationName ?? '—'} last />
            </View>

            <Button
              label={t('stock.takeLivePhoto')}
              icon="camera"
              loading={capturing}
              onPress={() => captureFor(confirmAnimal.id)}
            />
            <Button label={t('common.cancel')} variant="outline" disabled={capturing} onPress={() => setConfirmAnimal(null)} />
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}
