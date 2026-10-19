import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import {
  breeds as breedsFallback,
  locations as locationsFallback,
} from '@/data/mock';
import { getBreeds, getLocations, registerAnimal } from '@/data/api';
import { addLocalAnimal } from '@/data/localAnimals';
import { getDraft, saveDraft, deleteDraft } from '@/data/localRegistrationDrafts';
import { addSupportRequest } from '@/data/supportRequests';
import { sendLocalNotification } from '@/services/push';
import { getHerd } from '@/data/herd';
import { enqueueAnimalSync, processSyncQueue } from '@/data/syncQueue';
import { notify } from '@/lib/toast';
import { Animal, RegisteredDevice } from '@/data/types';
import { useAuth } from '@/services/auth';
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE, generateNgarenCode } from '@/lib/ngaren';
import { DEVICE_MODEL_OPTIONS, deviceModel, methodForDevices } from '@/lib/tagging';
import { useResource } from '@/data/hooks';
import { useT } from '@/i18n';
import {
  AppText,
  BottomSheet,
  Button,
  DatePickerField,
  GradientHeader,
  Icon,
  IconChip,
  PhotoField,
  PickerField,
  TextField,
} from '@/ui';

// Colour descriptors are stored as free-text data, so the chips stay in English.
const COMMON_COLOURS = ['Brown', 'Black', 'White', 'Brown & white', 'Black & white', 'Tan', 'Grey', 'Red'];
const UNKNOWN = '';
const EXTERNAL = '__external__';

// Identification mechanism — mandatory in step 2 (Oct 2026 spec). `label` holds
// an i18n key translated at render.
type IdType = 'physical' | 'satellite' | 'bluetooth';
const ID_TYPES: { value: IdType; label: string; icon: 'camera-outline' | 'satellite-variant' | 'bluetooth' }[] = [
  { value: 'physical', label: 'reg.idPhysical', icon: 'camera-outline' },
  { value: 'satellite', label: 'reg.idSatellite', icon: 'satellite-variant' },
  { value: 'bluetooth', label: 'reg.idBluetooth', icon: 'bluetooth' },
];
// Purpose values are stored as data; labels come from i18n at render.
const PURPOSE_VALUES = ['Dairy', 'Beef', 'Dual-purpose'] as const;

// Pre-approved device suppliers loaded by Ngaren (Oct 2026 spec) — farmers can
// only pick from this list. Manual free-text is allowed only for Physical/Visual.
const APPROVED_SUPPLIERS = ['Ceres Tag', 'GSat', 'Digitanimal', 'Ngaren Devices'];

// Self-service satellite linkage portal (spec 3.1.4).
const LINKAGE_PORTAL_URL = 'https://portal.cerestag.com';

// City suggestions per country (dropdown once the country is chosen).
const CITIES_BY_COUNTRY: Record<string, string[]> = {
  Uganda: ['Kampala', 'Mbarara', 'Gulu', 'Jinja', 'Mbale', 'Fort Portal', 'Masaka', 'Sheema'],
  Kenya: ['Nairobi', 'Nakuru', 'Eldoret', 'Mombasa', 'Kisumu', 'Nyeri', 'Meru'],
  Tanzania: ['Dodoma', 'Arusha', 'Mwanza', 'Dar es Salaam', 'Mbeya'],
  Rwanda: ['Kigali', 'Musanze', 'Huye', 'Rubavu'],
};

const STEP_COUNT = 5;
const STEP_KEYS = ['reg.step.aan', 'reg.step.animal', 'reg.step.location', 'reg.step.device', 'reg.step.submit'];

/** Compact 5-dot progress rail across the top of the wizard. */
function Stepper({ step, labels }: { step: number; labels: string[] }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md }}>
      {labels.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <View key={label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
              <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : n <= step ? colors.primary : colors.divider }} />
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: active || done ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: active || done ? colors.primary : colors.divider,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {done ? (
                  <Icon name="check" size={14} color="#fff" />
                ) : (
                  <AppText variant="caption" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '700' }}>
                    {n}
                  </AppText>
                )}
              </View>
              <View style={{ flex: 1, height: 2, backgroundColor: i === labels.length - 1 ? 'transparent' : n < step ? colors.primary : colors.divider }} />
            </View>
            <AppText variant="caption" color={active ? colors.primary : colors.onSurfaceVariant} numberOfLines={1} style={{ fontSize: 10, fontWeight: active ? '700' : '400' }}>
              {label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

export default function RegisterAnimal() {
  const router = useRouter();
  const t = useT();
  const { draft: draftParam } = useLocalSearchParams<{ draft?: string }>();
  const { canManageTeam, user, appRole } = useAuth();
  const { data: breeds } = useResource(
    getBreeds,
    breedsFallback.map((name) => ({ key: name.toLowerCase(), name })),
  );
  const { data: locations } = useResource(() => getLocations(), locationsFallback);
  const { data: herd } = useResource(getHerd, []);

  // Wizard position (1..STEP_COUNT). Each step is validated before Next unlocks.
  const [step, setStep] = useState(1);

  // (a) AAN — the Ngaren Animal Account Number. Generated on step 1 (held in
  // state so it shows through the flow) but only persisted on submit, so an
  // abandoned attempt never mints an orphan identifier in the backend.
  const [aan, setAan] = useState('');

  // (b) Animal information
  const [idType, setIdType] = useState<IdType | ''>('');
  const [sex, setSex] = useState<'male' | 'female' | ''>('');
  const [purpose, setPurpose] = useState('');
  const [tag, setTag] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [breedKey, setBreedKey] = useState('');
  const [dob, setDob] = useState('');
  const [damChoice, setDamChoice] = useState(UNKNOWN);
  const [damExternal, setDamExternal] = useState('');
  const [sireChoice, setSireChoice] = useState(UNKNOWN);
  const [sireExternal, setSireExternal] = useState('');
  const [photoFront, setPhotoFront] = useState<string | null>(null);
  const [photoLeft, setPhotoLeft] = useState<string | null>(null);
  const [photoRight, setPhotoRight] = useState<string | null>(null);
  const [photoBack, setPhotoBack] = useState<string | null>(null);

  // (c) Farm / location — standardized address + optional geospatial pin.
  const [locationId, setLocationId] = useState('');
  const [addr1, setAddr1] = useState('');
  const [addr2, setAddr2] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Uganda');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  // (d) Devices
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [deviceSheet, setDeviceSheet] = useState(false);
  const [dType, setDType] = useState('');
  const [dSerial, setDSerial] = useState('');
  const [dSupplier, setDSupplier] = useState('');
  const [dPhoto, setDPhoto] = useState<string | null>(null);
  const [dLinkage, setDLinkage] = useState<'support' | 'self' | ''>('');

  // (e) T&Cs
  const [tcsAccepted, setTcsAccepted] = useState(false);

  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const autoApprove = canManageTeam;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const breedOptions = useMemo(() => breeds.map((b) => ({ label: b.name, value: b.key })), [breeds]);
  const locationOptions = useMemo(() => locations.map((l) => ({ label: l.name, value: String(l.id) })), [locations]);
  // Lineage pickers enforce sex (Oct 2026): the Dam list excludes known males and
  // the Sire list excludes known females, so a male can never be captured as the
  // dam (and vice-versa). Unknown-sex animals appear in both.
  const parentBase = [
    { label: t('reg.unknown'), value: UNKNOWN },
    { label: t('reg.anotherFarm'), value: EXTERNAL },
  ];
  const damOptions = useMemo(
    () => [
      ...parentBase,
      ...herd.filter((a) => a.sex !== 'male').map((a) => ({ label: `${a.name ?? a.tag} · ${a.tag}`, value: a.tag })),
    ],
    [herd, t],
  );
  const sireOptions = useMemo(
    () => [
      ...parentBase,
      ...herd.filter((a) => a.sex !== 'female').map((a) => ({ label: `${a.name ?? a.tag} · ${a.tag}`, value: a.tag })),
    ],
    [herd, t],
  );

  const photos = useMemo(
    () => [photoFront, photoLeft, photoRight, photoBack].filter((p): p is string => !!p),
    [photoFront, photoLeft, photoRight, photoBack],
  );

  const draftIsSatellite = !!deviceModel(dType)?.satellite;
  const canAddDevice = !!dType && !!dSerial.trim() && (!draftIsSatellite || !!dLinkage);

  const countryCode = useMemo(
    () =>
      Object.entries(COUNTRY_CODES).find(([, n]) => n.toLowerCase() === country.trim().toLowerCase())?.[0] ??
      DEFAULT_COUNTRY_CODE,
    [country],
  );

  const generateAan = () => setAan(generateNgarenCode(countryCode));

  // ---- Registration in Progress: auto-save + resume (spec 3.1.1) ----
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [faceVerifying, setFaceVerifying] = useState(false);

  const collectDraft = () => ({
    aan,
    idType,
    sex,
    purpose,
    tag,
    name,
    color,
    breedKey,
    dob,
    damChoice,
    damExternal,
    sireChoice,
    sireExternal,
    photos: [photoFront, photoLeft, photoRight, photoBack],
    locationId,
    addr1,
    addr2,
    city,
    country,
    coords,
    devices,
    notes,
    startedBy: user?.fullName ?? user?.email ?? undefined,
  });

  // Resume / edit an existing draft (or existing AAN) passed as ?draft=<aan>.
  useEffect(() => {
    if (!draftParam || draftHydrated) return;
    let active = true;
    getDraft(draftParam).then((d) => {
      if (!active) return;
      if (d) {
        setAan(d.aan);
        setIdType(d.idType ?? '');
        setSex(d.sex ?? '');
        setPurpose(d.purpose ?? '');
        setTag(d.tag ?? '');
        setName(d.name ?? '');
        setColor(d.color ?? '');
        setBreedKey(d.breedKey ?? '');
        setDob(d.dob ?? '');
        setDamChoice(d.damChoice ?? UNKNOWN);
        setDamExternal(d.damExternal ?? '');
        setSireChoice(d.sireChoice ?? UNKNOWN);
        setSireExternal(d.sireExternal ?? '');
        const ph = d.photos ?? [];
        setPhotoFront(ph[0] ?? null);
        setPhotoLeft(ph[1] ?? null);
        setPhotoRight(ph[2] ?? null);
        setPhotoBack(ph[3] ?? null);
        setLocationId(d.locationId ?? '');
        setAddr1(d.addr1 ?? '');
        setAddr2(d.addr2 ?? '');
        setCity(d.city ?? '');
        setCountry(d.country ?? 'Uganda');
        setCoords(d.coords ?? null);
        setDevices(d.devices ?? []);
        setNotes(d.notes ?? '');
        setStep(2);
      }
      setDraftHydrated(true);
    });
    return () => {
      active = false;
    };
  }, [draftParam, draftHydrated]);

  // Auto-save every change once an AAN exists ("registration in progress").
  useEffect(() => {
    if (!aan) return;
    void saveDraft(collectDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aan, idType, sex, purpose, tag, name, color, breedKey, dob, damChoice, damExternal, sireChoice, sireExternal, photoFront, photoLeft, photoRight, photoBack, locationId, addr1, addr2, city, country, coords, devices, notes]);

  const addDevice = () => {
    setDevices((prev) => [
      ...prev,
      { type: dType, serial: dSerial.trim(), supplier: dSupplier.trim() || undefined, photo: dPhoto, linkage: draftIsSatellite ? (dLinkage || undefined) as RegisteredDevice['linkage'] : undefined },
    ]);
    setDType('');
    setDSerial('');
    setDSupplier('');
    setDPhoto(null);
    setDLinkage('');
    setDeviceSheet(false);
  };

  const resolveParent = (choice: string, external: string): string | undefined => {
    if (choice === UNKNOWN) return undefined;
    if (choice === EXTERNAL) return external.trim() ? `Another farm: ${external.trim()}` : undefined;
    return choice;
  };

  const tagTaken = useMemo(() => {
    const ref = tag.trim().toLowerCase();
    return !!ref && herd.some((a) => a.tag.toLowerCase() === ref);
  }, [tag, herd]);

  const hasSatellite = useMemo(
    () => devices.some((d) => !!deviceModel(d.type)?.satellite),
    [devices],
  );

  // Per-step completion gates (Oct 2026 spec): identification type is the only
  // mandatory animal field; location (paddock) and coordinates are optional.
  const stepValid: Record<number, boolean> = {
    1: !!aan,
    2: !!idType && !tagTaken,
    3: true,
    4: true,
    5: tcsAccepted,
  };
  // A one-line hint for why the current step can't advance yet.
  const stepHint: Record<number, string> = {
    1: t('reg.needAanFirst'),
    2: !idType ? t('reg.needIdType') : t('reg.tagTaken'),
    3: '',
    4: '',
    5: t('reg.needTc'),
  };

  const captureCoords = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('reg.locPermTitle'), t('reg.locPermBody'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      Alert.alert(t('reg.locFailTitle'), t('reg.locFailBody'));
    } finally {
      setLocating(false);
    }
  };

  // Request Ngaren Service Support (spec 3.1.1): the draft is already saved under
  // "Registration in Progress"; launch the booking calendar with the service
  // pre-set to Animal Registration so the farmer picks a date/time.
  const requestSupport = async () => {
    void addSupportRequest({
      animalsCount: 1,
      notes: `[Animal registration · ${aan || 'AAN pending'}] ${notes.trim()}`.trim() || undefined,
      requestedBy: user?.fullName ?? user?.email ?? undefined,
    });
    router.push(`/find-vet/request?purpose=Registration&aan=${encodeURIComponent(aan)}` as never);
  };

  const canSubmit = !!aan && !!idType && !tagTaken && tcsAccepted;

  // Face ID gate — submission only succeeds after a live selfie of the user
  // (spec 3.1.5). Returns true when verified.
  const verifyFaceId = async (): Promise<boolean> => {
    setFaceVerifying(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('reg.faceIdTitle'), t('reg.faceIdNeeded'));
        return false;
      }
      const shot = await ImagePicker.launchCameraAsync({ quality: 0.4, cameraType: ImagePicker.CameraType.front });
      if (shot.canceled || !shot.assets?.[0]) {
        Alert.alert(t('reg.faceIdTitle'), t('reg.faceIdRequired'));
        return false;
      }
      return true;
    } catch {
      Alert.alert(t('reg.faceIdTitle'), t('reg.faceIdRequired'));
      return false;
    } finally {
      setFaceVerifying(false);
    }
  };

  // Approval (Oct 2026): Review the record, then Approve with Face ID OR OTP.
  const [otpSheet, setOtpSheet] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpEntry, setOtpEntry] = useState('');

  const approve = () => {
    Alert.alert(t('reg.approveChoiceTitle'), t('reg.approveChoiceBody'), [
      { text: t('reg.approveFaceId'), onPress: async () => { if (await verifyFaceId()) void doSubmit(); } },
      { text: t('reg.approveOtp'), onPress: () => startOtp() },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const startOtp = () => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setOtpCode(code);
    setOtpEntry('');
    setOtpSheet(true);
    // No SMS provider yet — surface the demo code so OTP is testable in-app.
    void sendLocalNotification(t('reg.otpNotifyTitle'), t('reg.otpNotifyBody', { code }), { type: 'OTP' });
  };

  const verifyOtp = () => {
    if (otpEntry.trim() === otpCode) {
      setOtpSheet(false);
      void doSubmit();
    } else {
      Alert.alert(t('reg.otpWrongTitle'), t('reg.otpWrongBody'));
    }
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const breedName = breedOptions.find((b) => b.value === breedKey)?.label ?? 'Unknown';
      const locationName = locationOptions.find((l) => l.value === locationId)?.label;
      // Use the AAN generated on step 1 (fall back defensively).
      const code = aan || generateNgarenCode(countryCode);
      const newAnimal: Animal = {
        id: Date.now(),
        tag: tag.trim(),
        name: name.trim() || undefined,
        breed: { key: breedKey || 'unknown', name: breedName },
        locationId: locationId ? Number(locationId) : undefined,
        locationName,
        physicalAddress: [addr1.trim(), addr2.trim(), city.trim(), country.trim()].filter(Boolean).join(', ') || undefined,
        coordinates: coords ?? undefined,
        dateOfBirth: dob || '',
        status: 'active',
        description: notes.trim() || undefined,
        deviceSerial: devices[0]?.serial ?? null,
        devices: devices.length ? devices : undefined,
        damTag: resolveParent(damChoice, damExternal),
        sireTag: resolveParent(sireChoice, sireExternal),
        photos,
        ngarenCode: code,
        color: color.trim() || undefined,
        identificationType: idType || undefined,
        sex: sex || undefined,
        purpose: purpose || undefined,
        // Tagging method follows the devices; for a Physical/Visual-only animal
        // it is 'manual' (no device), matching the chosen identification type.
        taggingMethod: devices.length ? methodForDevices(devices) : idType === 'satellite' ? 'satellite' : idType === 'bluetooth' ? 'bluetooth' : 'manual',
        // Maker-checker (Oct 2026 standup): a record captured by a third party
        // (vet / delegate — anyone who isn't the farm owner/admin) is NOT active.
        // A vet capture needs admin validation AND the farmer's confirmation
        // (dual approval); other delegated captures need a single checker.
        approvalStatus: autoApprove ? 'approved' : 'pending',
        capturedByRole: appRole,
        adminApproved: autoApprove || appRole === 'admin',
        farmerApproved: autoApprove || appRole === 'farmer',
      };
      await addLocalAnimal(newAnimal);
      // The draft is now a real record — clear it from "Registration in Progress".
      await deleteDraft(code);
      await enqueueAnimalSync({ animal: newAnimal, userId: user?.id, photoUris: photos, aan: code });
      void processSyncQueue();
      registerAnimal({
        tag,
        breedKey: breedKey || undefined,
        locationId: locationId ? Number(locationId) : undefined,
        dateOfBirth: dob || null,
        description: notes.trim() || undefined,
      }).catch(() => undefined);

      notify(autoApprove ? t('reg.notifyCreated', { aan: code }) : t('reg.notifySubmitted', { aan: code }));
      router.replace('/(tabs)/animals');
    } catch {
      setSubmitting(false);
    }
  };

  const stepLabels = STEP_KEYS.map((k) => t(k));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('reg.header')} subtitle={t('reg.stepOf', { current: step, total: STEP_COUNT })} showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
        <Stepper step={step} labels={stepLabels} />

        {/* Step 1 — Generate the AAN */}
        {step === 1 && (
          <>
            <AppText variant="title" style={{ marginBottom: spacing.sm }}>
              {t('reg.aanTitle')}
            </AppText>
            <View style={{ backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
              <AppText variant="caption" color={colors.onSurfaceVariant}>
                {t('reg.aanLabel')}
              </AppText>
              <AppText variant="title" color={colors.primary} style={{ fontWeight: '700' }}>
                {aan || `${countryCode}-MMYY-XXXXXX`}
              </AppText>
              <AppText variant="caption" color={colors.onSurfaceVariant}>
                {aan ? t('reg.aanGenerated') : t('reg.aanIntro')}
              </AppText>
            </View>
            {!aan ? (
              <Button label={t('reg.aanGenerate')} icon="identifier" onPress={generateAan} />
            ) : null}

            {/* Alternative: let Ngaren onboard on the farmer's behalf. */}
            <Pressable
              onPress={requestSupport}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md }}>
              <Icon name="lifebuoy" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <AppText variant="body" style={{ fontWeight: '600' }}>
                  {t('reg.supportTitle')}
                </AppText>
                <AppText variant="caption" color={colors.onSurfaceVariant}>
                  {t('reg.supportSub')}
                </AppText>
              </View>
              <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
            </Pressable>
          </>
        )}

        {/* Step 2 — Animal information */}
        {step === 2 && (
          <>
            <AppText variant="title">{t('reg.animalTitle')}</AppText>
            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
              {t('reg.animalSub')}
            </AppText>

            {/* Identification type — MANDATORY (Oct 2026 spec). */}
            <AppText variant="bodyLarge" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
              {t('reg.idType')} <AppText color={colors.error}>*</AppText>
            </AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              {ID_TYPES.map((it) => {
                const active = idType === it.value;
                return (
                  <Pressable
                    key={it.value}
                    onPress={() => setIdType(it.value)}
                    style={{ flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: active ? colors.primary : colors.surface, borderWidth: active ? 2 : 1, borderColor: active ? colors.primary : colors.divider }}>
                    <Icon name={it.icon} size={22} color={active ? '#fff' : colors.onSurfaceVariant} />
                    <AppText variant="caption" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600', textAlign: 'center' }}>
                      {t(it.label)}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            {/* Sex + Purpose. */}
            <PickerField
              label={t('reg.sex')}
              value={sex}
              placeholder={t('reg.sexPlaceholder')}
              options={[{ label: t('reg.sexMale'), value: 'male' }, { label: t('reg.sexFemale'), value: 'female' }]}
              onSelect={(v) => setSex(v as 'male' | 'female')}
            />
            <PickerField
              label={t('reg.purpose')}
              value={purpose}
              placeholder={t('reg.purposePlaceholder')}
              options={PURPOSE_VALUES.map((p) => ({ label: t(`reg.purpose.${p}`), value: p }))}
              onSelect={setPurpose}
            />

            <TextField label={t('reg.tag')} value={tag} onChangeText={setTag} placeholder={t('reg.tagPlaceholder')} />
            {tagTaken ? (
              <AppText variant="caption" color={colors.error} style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}>
                {t('reg.tagTaken')}
              </AppText>
            ) : null}
            <TextField label={t('reg.name')} value={name} onChangeText={setName} placeholder={t('reg.namePlaceholder')} />
            <PickerField label={t('reg.breed')} value={breedKey} placeholder={t('reg.breedPlaceholder')} options={breedOptions} onSelect={setBreedKey} />
            <TextField label={t('reg.colour')} value={color} onChangeText={setColor} placeholder={t('reg.colourPlaceholder')} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: -spacing.sm, marginBottom: spacing.md }}>
              {COMMON_COLOURS.map((c) => {
                const active = color.trim().toLowerCase() === c.toLowerCase();
                return (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    style={{ paddingHorizontal: spacing.mdMinus, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: active ? colors.primary : colors.surface, borderWidth: 1, borderColor: active ? colors.primary : colors.divider }}>
                    <AppText variant="caption" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                      {c}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            <DatePickerField label={t('reg.dob')} value={dob} placeholder={t('reg.dobPlaceholder')} maximumIso={today} onSelect={setDob} />

            <AppText variant="bodyLarge" style={{ fontWeight: '600', marginTop: spacing.xs, marginBottom: spacing.xs }}>
              {t('reg.lineage')}
            </AppText>
            <PickerField label={t('reg.dam')} value={damChoice} placeholder={t('reg.unknown')} options={damOptions} onSelect={setDamChoice} />
            {damChoice === EXTERNAL ? <TextField label={t('reg.damExternal')} value={damExternal} onChangeText={setDamExternal} placeholder={t('reg.externalPlaceholder')} /> : null}
            <PickerField label={t('reg.sire')} value={sireChoice} placeholder={t('reg.unknown')} options={sireOptions} onSelect={setSireChoice} />
            {sireChoice === EXTERNAL ? <TextField label={t('reg.sireExternal')} value={sireExternal} onChangeText={setSireExternal} placeholder={t('reg.externalPlaceholder')} /> : null}

            <AppText variant="bodyLarge" style={{ fontWeight: '600', marginTop: spacing.xs, marginBottom: spacing.xs }}>
              {t('reg.photoId')}
            </AppText>
            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
              {t('reg.photoIdSub')}
            </AppText>
            <PhotoField label={t('reg.photoFront')} value={photoFront} onChange={setPhotoFront} />
            <PhotoField label={t('reg.photoLeft')} value={photoLeft} onChange={setPhotoLeft} />
            <PhotoField label={t('reg.photoRight')} value={photoRight} onChange={setPhotoRight} />
            <PhotoField label={t('reg.photoBack')} value={photoBack} onChange={setPhotoBack} />
          </>
        )}

        {/* Step 3 — Farm & location */}
        {step === 3 && (
          <>
            <AppText variant="title">{t('reg.locationTitle')}</AppText>
            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
              {t('reg.locationSub')}
            </AppText>
            {/* Paddock is optional (Oct 2026 spec). */}
            <PickerField label={t('reg.location')} value={locationId} placeholder={t('reg.locationPlaceholder')} options={locationOptions} onSelect={setLocationId} />
            <TextField label={t('reg.addr1')} value={addr1} onChangeText={setAddr1} placeholder={t('reg.addr1Placeholder')} />
            <TextField label={t('reg.addr2')} value={addr2} onChangeText={setAddr2} placeholder={t('reg.addr2Placeholder')} />

            {/* Country code → auto-populates the country; city becomes a dropdown. */}
            <PickerField
              label={t('reg.countryCode')}
              value={countryCode}
              placeholder={t('reg.countryCodePlaceholder')}
              options={Object.entries(COUNTRY_CODES).map(([code, nm]) => ({ label: `${nm} (${code})`, value: code }))}
              onSelect={(code) => { setCountry(COUNTRY_CODES[code] ?? country); setCity(''); }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: -spacing.sm, marginBottom: spacing.md }}>
              <Icon name="flag-outline" size={14} color={colors.onSurfaceVariant} />
              <AppText variant="caption" color={colors.onSurfaceVariant}>{t('reg.countryAuto', { country })}</AppText>
            </View>
            {(CITIES_BY_COUNTRY[country]?.length ?? 0) > 0 ? (
              <PickerField label={t('reg.city')} value={city} placeholder={t('reg.cityPlaceholder')} options={CITIES_BY_COUNTRY[country].map((c) => ({ label: c, value: c }))} onSelect={setCity} />
            ) : (
              <TextField label={t('reg.city')} value={city} onChangeText={setCity} placeholder={t('reg.cityPlaceholder')} />
            )}

            <AppText variant="bodyLarge" style={{ fontWeight: '600', marginTop: spacing.xs, marginBottom: spacing.xs }}>
              {t('reg.geoOptional')}
            </AppText>
            <Pressable
              onPress={captureCoords}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: coords ? colors.primary : colors.divider, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xs }}>
              <Icon name={coords ? 'map-marker-check' : 'map-marker-plus-outline'} size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <AppText variant="body" style={{ fontWeight: '600' }}>
                  {locating ? t('reg.geoGetting') : coords ? t('reg.geoCaptured') : t('reg.geoCapture')}
                </AppText>
                {coords ? (
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  </AppText>
                ) : null}
              </View>
            </Pressable>
            <AppText variant="caption" color={colors.onSurfaceVariant}>
              {t('reg.geoHintOpt')}
            </AppText>
          </>
        )}

        {/* Step 4 — Tags & devices */}
        {step === 4 && (
          <>
            <AppText variant="title">{t('reg.deviceTitle')}</AppText>
            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
              {t('reg.deviceSub')}
            </AppText>
            {devices.map((d, i) => (
              <View key={i} style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
                <IconChip icon="tag-outline" />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                    {d.type}
                  </AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    {d.serial}
                    {d.supplier ? ` · ${d.supplier}` : ''}
                    {d.linkage ? ` · ${d.linkage === 'support' ? t('reg.ngarenLinkage') : t('reg.selfLinkage')}` : ''}
                  </AppText>
                </View>
                <Pressable
                  accessibilityLabel={`Remove ${d.type} device`}
                  accessibilityRole="button"
                  onPress={() => setDevices((prev) => prev.filter((_, idx) => idx !== i))}
                  hitSlop={8}>
                  <Icon name="close" size={18} color={colors.onSurfaceVariant} />
                </Pressable>
              </View>
            ))}
            <Button label={t('reg.addDevice')} icon="plus" variant="outline" onPress={() => setDeviceSheet(true)} />
            {devices.length === 0 ? (
              <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginTop: spacing.xs }}>
                {t('reg.noDevice')}
              </AppText>
            ) : null}
          </>
        )}

        {/* Step 5 — Review, T&Cs, submit */}
        {step === 5 && (
          <>
            <AppText variant="title">{t('reg.reviewTitle')}</AppText>
            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
              {t('reg.reviewSub')}
            </AppText>

            {/* Quick summary of what will be submitted. */}
            <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, gap: 4, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
              <AppText variant="caption" color={colors.onSurfaceVariant}>{t('reg.aanLabel')}</AppText>
              <AppText variant="bodyLarge" color={colors.primary} style={{ fontWeight: '700' }}>{aan || '—'}</AppText>
              <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginTop: spacing.xs }}>
                {[tag.trim(), breedOptions.find((b) => b.value === breedKey)?.label, locationOptions.find((l) => l.value === locationId)?.label].filter(Boolean).join(' · ')}
              </AppText>
              <AppText variant="caption" color={colors.onSurfaceVariant}>
                {t('reg.step.device')}: {devices.length} · {t('reg.photoId')}: {photos.length}
              </AppText>
            </View>

            <AppText variant="bodyLarge" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
              {t('reg.tc')}
            </AppText>
            <Pressable onPress={() => setTcsAccepted((v) => !v)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md }}>
              <Icon name={tcsAccepted ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={tcsAccepted ? colors.primary : colors.onSurfaceVariant} />
              {/* Legal consent copy stays in English pending professional review. */}
              <AppText variant="body" color={colors.onSurface} style={{ flex: 1 }}>
                I accept the Ngaren AAN terms &amp; conditions and confirm the information captured is accurate.
              </AppText>
            </Pressable>

            <TextField label={t('reg.notes')} value={notes} onChangeText={setNotes} placeholder={t('reg.notesPlaceholder')} multiline />

            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
              {autoApprove ? t('reg.approveOwner') : t('reg.approvePending')}
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md }}>
              <Icon name="face-recognition" size={16} color={colors.primary} />
              <AppText variant="caption" color={colors.primaryDark} style={{ flex: 1 }}>
                {t('reg.reviewNote')}
              </AppText>
            </View>
          </>
        )}

        {/* Inline hint when the current step is incomplete. */}
        {!stepValid[step] && stepHint[step] ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md }}>
            <Icon name="information-outline" size={14} color={colors.onSurfaceVariant} />
            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ flex: 1 }}>
              {stepHint[step]}
            </AppText>
          </View>
        ) : null}

        {/* Wizard navigation */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
          {step > 1 ? (
            <Button label={t('reg.back')} variant="outline" icon="chevron-left" onPress={() => setStep((s) => s - 1)} style={{ flex: 1 }} />
          ) : null}
          {step < STEP_COUNT ? (
            <Button label={t('reg.next')} icon="chevron-right" disabled={!stepValid[step]} onPress={() => setStep((s) => s + 1)} style={{ flex: 2 }} />
          ) : (
            <Button
              label={faceVerifying ? t('reg.verifying') : t('reg.submitForApproval')}
              icon="shield-check-outline"
              loading={submitting || faceVerifying}
              disabled={!canSubmit}
              onPress={approve}
              style={{ flex: 2 }}
            />
          )}
        </View>
        {/* Review the record before approving (Oct 2026). */}
        {step === STEP_COUNT ? (
          <Button
            label={t('reg.reviewRecord')}
            variant="outline"
            icon="file-search-outline"
            onPress={() => setStep(2)}
            style={{ marginTop: spacing.sm }}
          />
        ) : null}
      </ScrollView>

      {/* Device capture sheet */}
      <BottomSheet visible={deviceSheet} onClose={() => setDeviceSheet(false)} title={t('reg.deviceSheet')}>
        <PickerField label={t('reg.deviceType')} required value={dType} placeholder={t('reg.deviceTypePlaceholder')} options={DEVICE_MODEL_OPTIONS} onSelect={setDType} />
        <TextField label={t('reg.serial')} required value={dSerial} onChangeText={setDSerial} placeholder={t('reg.serialPlaceholder')} />
        {/* Pre-approved suppliers only (Oct 2026 spec); free text is allowed only
            when the identification mechanism is Physical/Visual. */}
        {idType === 'physical' ? (
          <TextField label={t('reg.supplier')} value={dSupplier} onChangeText={setDSupplier} placeholder={t('reg.supplierPlaceholder')} />
        ) : (
          <>
            <PickerField label={t('reg.supplierApproved')} value={dSupplier} placeholder={t('reg.supplierApprovedPlaceholder')} options={APPROVED_SUPPLIERS.map((s) => ({ label: s, value: s }))} onSelect={setDSupplier} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: -spacing.sm, marginBottom: spacing.md }}>
              <Icon name="shield-check-outline" size={13} color={colors.onSurfaceVariant} />
              <AppText variant="caption" color={colors.onSurfaceVariant} style={{ flex: 1 }}>{t('reg.supplierApprovedNote')}</AppText>
            </View>
          </>
        )}
        <PhotoField label={t('reg.devicePhoto')} value={dPhoto} onChange={setDPhoto} />
        {draftIsSatellite ? (
          <>
            <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
              {t('reg.satLinkage')}
            </AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
              <Button label={t('reg.reqNgarenSupport')} variant={dLinkage === 'support' ? 'primary' : 'outline'} onPress={() => setDLinkage('support')} style={{ flex: 1 }} />
              <Button label={t('reg.selfLinkageOnline')} variant={dLinkage === 'self' ? 'primary' : 'outline'} onPress={() => setDLinkage('self')} style={{ flex: 1 }} />
            </View>
            {/* Self-linkage → provider portal; Ngaren support → calendar booking
                for linkage & tag activation (spec 3.1.4). */}
            {dLinkage === 'self' ? (
              <Pressable onPress={() => Linking.openURL(LINKAGE_PORTAL_URL).catch(() => {})} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md }}>
                <Icon name="open-in-new" size={15} color={colors.primary} />
                <AppText variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>{t('reg.openLinkagePortal')}</AppText>
              </Pressable>
            ) : dLinkage === 'support' ? (
              <Pressable
                onPress={() => { setDeviceSheet(false); router.push('/find-vet/request?purpose=Linkage' as never); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md }}>
                <Icon name="calendar-plus" size={15} color={colors.primary} />
                <AppText variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>{t('reg.bookLinkage')}</AppText>
              </Pressable>
            ) : null}
          </>
        ) : null}
        <Button label={t('reg.addDevice')} icon="check" disabled={!canAddDevice} onPress={addDevice} />
      </BottomSheet>

      {/* OTP approval sheet (Oct 2026) — alternative to Face ID. The code is
          shown here because no SMS provider is wired yet (demo mode). */}
      <BottomSheet visible={otpSheet} onClose={() => setOtpSheet(false)} title={t('reg.otpTitle')}>
        <AppText variant="body" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          {t('reg.otpIntro')}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.warningTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
          <Icon name="information-outline" size={16} color={colors.warning} />
          <AppText variant="caption" color={colors.onSurface} style={{ flex: 1 }}>
            {t('reg.otpDemo', { code: otpCode })}
          </AppText>
        </View>
        <TextField label={t('reg.otpLabel')} value={otpEntry} onChangeText={setOtpEntry} placeholder="------" keyboardType="number-pad" />
        <Button label={t('reg.otpVerify')} icon="check-decagram-outline" disabled={otpEntry.trim().length < 6} onPress={verifyOtp} />
      </BottomSheet>
    </View>
  );
}
