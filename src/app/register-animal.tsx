import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import {
  breeds as breedsFallback,
  locations as locationsFallback,
} from '@/data/mock';
import { getBreeds, getLocations, registerAnimal } from '@/data/api';
import { addLocalAnimal } from '@/data/localAnimals';
import { addSupportRequest } from '@/data/supportRequests';
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
  const { canManageTeam, user } = useAuth();
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
  const parentOptions = useMemo(
    () => [
      { label: t('reg.unknown'), value: UNKNOWN },
      { label: t('reg.anotherFarm'), value: EXTERNAL },
      ...herd.map((a) => ({ label: `${a.name ?? a.tag} · ${a.tag}`, value: a.tag })),
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

  // Per-step completion gates.
  const stepValid: Record<number, boolean> = {
    1: !!aan,
    2: !!tag.trim() && !tagTaken && !!breedKey && !!photoFront,
    3: !!locationId,
    4: true,
    5: tcsAccepted && (!hasSatellite || !!coords),
  };
  // A one-line hint for why the current step can't advance yet.
  const stepHint: Record<number, string> = {
    1: t('reg.needAanFirst'),
    2: t('reg.needAnimal'),
    3: t('reg.needLocation'),
    4: '',
    5: !tcsAccepted ? t('reg.needTc') : t('reg.needCoords'),
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

  const requestSupport = async () => {
    const wo = await addSupportRequest({
      animalsCount: 1,
      notes: notes.trim() || undefined,
      requestedBy: user?.fullName ?? user?.email ?? undefined,
    });
    Alert.alert(
      t('reg.supportDoneTitle'),
      t('reg.supportDoneBody', { id: wo.workOrderId }),
      [{ text: t('reg.done'), onPress: () => router.replace('/(tabs)/animals') }],
    );
  };

  const canSubmit =
    !!aan && !!tag.trim() && !tagTaken && !!breedKey && !!locationId && !!photoFront && tcsAccepted && (!hasSatellite || !!coords);

  const onSubmit = async () => {
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
        taggingMethod: methodForDevices(devices),
        // Maker-checker (Oct 2026 standup): a record captured by a third party
        // (vet / delegate — anyone who isn't the farm owner/admin) is NOT active.
        // It needs admin validation AND the farmer's confirmation first.
        approvalStatus: autoApprove ? 'approved' : 'pending',
      };
      await addLocalAnimal(newAnimal);
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
            <TextField label={t('reg.tag')} required value={tag} onChangeText={setTag} placeholder={t('reg.tagPlaceholder')} />
            {tagTaken ? (
              <AppText variant="caption" color={colors.error} style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}>
                {t('reg.tagTaken')}
              </AppText>
            ) : null}
            <TextField label={t('reg.name')} value={name} onChangeText={setName} placeholder={t('reg.namePlaceholder')} />
            <PickerField label={t('reg.breed')} required value={breedKey} placeholder={t('reg.breedPlaceholder')} options={breedOptions} onSelect={setBreedKey} />
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
            <PickerField label={t('reg.dam')} value={damChoice} placeholder={t('reg.unknown')} options={parentOptions} onSelect={setDamChoice} />
            {damChoice === EXTERNAL ? <TextField label={t('reg.damExternal')} value={damExternal} onChangeText={setDamExternal} placeholder={t('reg.externalPlaceholder')} /> : null}
            <PickerField label={t('reg.sire')} value={sireChoice} placeholder={t('reg.unknown')} options={parentOptions} onSelect={setSireChoice} />
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
            <PickerField label={t('reg.location')} required value={locationId} placeholder={t('reg.locationPlaceholder')} options={locationOptions} onSelect={setLocationId} />
            <TextField label={t('reg.addr1')} value={addr1} onChangeText={setAddr1} placeholder={t('reg.addr1Placeholder')} />
            <TextField label={t('reg.addr2')} value={addr2} onChangeText={setAddr2} placeholder={t('reg.addr2Placeholder')} />
            <TextField label={t('reg.city')} value={city} onChangeText={setCity} placeholder={t('reg.cityPlaceholder')} />
            <TextField label={t('reg.country')} value={country} onChangeText={setCountry} placeholder={t('reg.countryPlaceholder')} />

            <AppText variant="bodyLarge" style={{ fontWeight: '600', marginTop: spacing.xs, marginBottom: spacing.xs }}>
              {hasSatellite ? t('reg.geoRequired') : t('reg.geoOptional')}
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
              {hasSatellite ? t('reg.geoHintSat') : t('reg.geoHintOpt')}
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
              label={autoApprove ? t('reg.createAan') : t('reg.submitActivation')}
              loading={submitting}
              disabled={!canSubmit}
              onPress={onSubmit}
              style={{ flex: 2 }}
            />
          )}
        </View>
      </ScrollView>

      {/* Device capture sheet */}
      <BottomSheet visible={deviceSheet} onClose={() => setDeviceSheet(false)} title={t('reg.deviceSheet')}>
        <PickerField label={t('reg.deviceType')} required value={dType} placeholder={t('reg.deviceTypePlaceholder')} options={DEVICE_MODEL_OPTIONS} onSelect={setDType} />
        <TextField label={t('reg.serial')} required value={dSerial} onChangeText={setDSerial} placeholder={t('reg.serialPlaceholder')} />
        <TextField label={t('reg.supplier')} value={dSupplier} onChangeText={setDSupplier} placeholder={t('reg.supplierPlaceholder')} />
        <PhotoField label={t('reg.devicePhoto')} value={dPhoto} onChange={setDPhoto} />
        {draftIsSatellite ? (
          <>
            <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
              {t('reg.satLinkage')}
            </AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              <Button label={t('reg.reqNgarenSupport')} variant={dLinkage === 'support' ? 'primary' : 'outline'} onPress={() => setDLinkage('support')} style={{ flex: 1 }} />
              <Button label={t('reg.selfLinkageOnline')} variant={dLinkage === 'self' ? 'primary' : 'outline'} onPress={() => setDLinkage('self')} style={{ flex: 1 }} />
            </View>
          </>
        ) : null}
        <Button label={t('reg.addDevice')} icon="check" disabled={!canAddDevice} onPress={addDevice} />
      </BottomSheet>
    </View>
  );
}
