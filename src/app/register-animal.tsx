import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
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
import { getHerd, syncAnimalToLineage } from '@/data/herd';
import { uploadAnimalPhotos } from '@/lib/imageUpload';
import { Animal, RegisteredDevice } from '@/data/types';
import { useAuth } from '@/services/auth';
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE, generateNgarenCode } from '@/lib/ngaren';
import { DEVICE_MODEL_OPTIONS, deviceModel, methodForDevices } from '@/lib/tagging';
import { useResource } from '@/data/hooks';
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
  Screen,
  TextField,
} from '@/ui';

const COMMON_COLOURS = ['Brown', 'Black', 'White', 'Brown & white', 'Black & white', 'Tan', 'Grey', 'Red'];
const UNKNOWN = '';
const EXTERNAL = '__external__';

function SectionHeading({ step, title, subtitle }: { step: string; title: string; subtitle?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <AppText variant="caption" color="#fff" style={{ fontWeight: '700' }}>
          {step}
        </AppText>
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="title">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

export default function RegisterAnimal() {
  const router = useRouter();
  const { canManageTeam, user } = useAuth();
  const { data: breeds } = useResource(
    getBreeds,
    breedsFallback.map((name) => ({ key: name.toLowerCase(), name })),
  );
  const { data: locations } = useResource(() => getLocations(), locationsFallback);
  const { data: herd } = useResource(getHerd, []);

  // (a) AAN — the Ngaren Animal Account Number. Per the Aug 29 2026 standup it is
  // generated ONLY on submission (once the mandatory details exist), not on open,
  // to avoid minting orphan identifiers for abandoned attempts.

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

  // (c) Farm / location — standardized address (Aug 29 2026 standup): Address
  // Line 1/2, City, Country — geography-agnostic, replacing village/parish/district.
  const [locationId, setLocationId] = useState('');
  const [addr1, setAddr1] = useState('');
  const [addr2, setAddr2] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Uganda');
  // Google geospatial coordinates — optional, mandatory when a satellite device
  // is attached.
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
      { label: 'Unknown', value: UNKNOWN },
      { label: 'Another farm (not in system)', value: EXTERNAL },
      ...herd.map((a) => ({ label: `${a.name ?? a.tag} · ${a.tag}`, value: a.tag })),
    ],
    [herd],
  );

  const photos = useMemo(
    () => [photoFront, photoLeft, photoRight, photoBack].filter((p): p is string => !!p),
    [photoFront, photoLeft, photoRight, photoBack],
  );

  const draftIsSatellite = !!deviceModel(dType)?.satellite;
  const canAddDevice = !!dType && !!dSerial.trim() && (!draftIsSatellite || !!dLinkage);

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

  // Farmer references should be unique within the herd.
  const tagTaken = useMemo(() => {
    const t = tag.trim().toLowerCase();
    return !!t && herd.some((a) => a.tag.toLowerCase() === t);
  }, [tag, herd]);

  // Coordinates become mandatory once a satellite device is attached.
  const hasSatellite = useMemo(
    () => devices.some((d) => !!deviceModel(d.type)?.satellite),
    [devices],
  );

  const captureCoords = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Location permission needed', 'Enable location access to capture the animal’s coordinates.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      Alert.alert('Could not get location', 'Please try again, or continue without coordinates.');
    } finally {
      setLocating(false);
    }
  };

  // "Request for support" (Aug 29 2026 standup): mint a Work Order so the Ngaren
  // team can complete onboarding, device association and activation on the
  // farmer's behalf, rather than the farmer self-onboarding.
  const requestSupport = async () => {
    const wo = await addSupportRequest({
      animalsCount: 1,
      notes: notes.trim() || undefined,
      requestedBy: user?.fullName ?? user?.email ?? undefined,
    });
    Alert.alert(
      'Support requested',
      `Work Order ${wo.workOrderId} created. Our team will contact you to complete onboarding, device association and activation.`,
      [{ text: 'Done', onPress: () => router.replace('/(tabs)/animals') }],
    );
  };

  const canSubmit =
    !!tag.trim() && !tagTaken && !!breedKey && !!locationId && !!photoFront && tcsAccepted && (!hasSatellite || !!coords);

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      const breedName = breedOptions.find((b) => b.value === breedKey)?.label ?? 'Unknown';
      const locationName = locationOptions.find((l) => l.value === locationId)?.label;
      // Generate the AAN now, on submission, using the country's operational code.
      const countryCode =
        Object.entries(COUNTRY_CODES).find(([, n]) => n.toLowerCase() === country.trim().toLowerCase())?.[0] ??
        DEFAULT_COUNTRY_CODE;
      const aan = generateNgarenCode(countryCode);
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
        ngarenCode: aan,
        color: color.trim() || undefined,
        taggingMethod: methodForDevices(devices),
        approvalStatus: autoApprove ? 'approved' : 'pending',
      };
      await addLocalAnimal(newAnimal);

      // Background: compress + upload the photos, then write-through to Supabase
      // animal_lineage with the uploaded URLs so the AAN + photos sync to the web
      // command centre. Fire-and-forget so navigation stays instant; local URIs
      // already drive on-device display, and everything degrades gracefully.
      (async () => {
        const urls = user?.id && photos.length ? await uploadAnimalPhotos(photos, user.id, aan) : [];
        await syncAnimalToLineage(newAnimal, user?.id, urls);
      })().catch(() => undefined);
      registerAnimal({
        tag,
        breedKey: breedKey || undefined,
        locationId: locationId ? Number(locationId) : undefined,
        dateOfBirth: dob || null,
        description: notes.trim() || undefined,
      }).catch(() => undefined);

      router.replace('/(tabs)/animals');
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Create Animal Account" subtitle="Ngaren Animal Account Number (AAN)" showBack />
      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        {/* (a) AAN — assigned on submission */}
        <View style={{ backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm }}>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            Animal Account Number (AAN)
          </AppText>
          <AppText variant="title" color={colors.primary} style={{ fontWeight: '700' }}>
            {(Object.entries(COUNTRY_CODES).find(([, n]) => n.toLowerCase() === country.trim().toLowerCase())?.[0] ?? DEFAULT_COUNTRY_CODE)}-MMYY-XXXXXX
          </AppText>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            The animal’s permanent identity — assigned automatically when you submit this form.
          </AppText>
        </View>

        {/* Do-it-yourself vs. request Ngaren support */}
        <Pressable
          onPress={requestSupport}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm }}>
          <Icon name="lifebuoy" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <AppText variant="body" style={{ fontWeight: '600' }}>
              Prefer we set this up for you?
            </AppText>
            <AppText variant="caption" color={colors.onSurfaceVariant}>
              Request Ngaren support — we’ll raise a work order and onboard on your behalf.
            </AppText>
          </View>
          <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
        </Pressable>

        {/* (b) Animal information */}
        <SectionHeading step="b" title="Animal information" subtitle="Farmer reference, descriptors & 360° photos" />
        <TextField label="Farmer reference (Tag ID)" required value={tag} onChangeText={setTag} placeholder="e.g. A-073" />
        {tagTaken ? (
          <AppText variant="caption" color={colors.error} style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}>
            This tag is already used in your herd — choose a unique reference.
          </AppText>
        ) : null}
        <TextField label="Name" value={name} onChangeText={setName} placeholder="Optional friendly name" />
        <PickerField label="Breed" required value={breedKey} placeholder="Select a breed" options={breedOptions} onSelect={setBreedKey} />
        <TextField label="Colour / markings" value={color} onChangeText={setColor} placeholder="e.g. Brown with white patch" />
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
        <DatePickerField label="Date of Birth" value={dob} placeholder="Select date of birth" maximumIso={today} onSelect={setDob} />

        <AppText variant="bodyLarge" style={{ fontWeight: '600', marginTop: spacing.xs, marginBottom: spacing.xs }}>
          Lineage
        </AppText>
        <PickerField label="Dam (mother)" value={damChoice} placeholder="Unknown" options={parentOptions} onSelect={setDamChoice} />
        {damChoice === EXTERNAL ? <TextField label="Dam reference (another farm)" value={damExternal} onChangeText={setDamExternal} placeholder="e.g. tag or farm name" /> : null}
        <PickerField label="Sire (father)" value={sireChoice} placeholder="Unknown" options={parentOptions} onSelect={setSireChoice} />
        {sireChoice === EXTERNAL ? <TextField label="Sire reference (another farm)" value={sireExternal} onChangeText={setSireExternal} placeholder="e.g. tag or farm name" /> : null}

        <AppText variant="bodyLarge" style={{ fontWeight: '600', marginTop: spacing.xs, marginBottom: spacing.xs }}>
          360° Photo ID
        </AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          Front, both sides and back. The front photo is the animal’s display photo.
        </AppText>
        <PhotoField label="Front (required · display photo)" value={photoFront} onChange={setPhotoFront} />
        <PhotoField label="Left side" value={photoLeft} onChange={setPhotoLeft} />
        <PhotoField label="Right side" value={photoRight} onChange={setPhotoRight} />
        <PhotoField label="Back" value={photoBack} onChange={setPhotoBack} />

        {/* (c) Farm / location — standardized address + geospatial pin */}
        <SectionHeading step="c" title="Farm & location" subtitle="Where the animal is based" />
        <PickerField label="Location" required value={locationId} placeholder="Select a location" options={locationOptions} onSelect={setLocationId} />
        <TextField label="Address Line 1" value={addr1} onChangeText={setAddr1} placeholder="e.g. Plot 12, Nakasero Road" />
        <TextField label="Address Line 2" value={addr2} onChangeText={setAddr2} placeholder="Optional" />
        <TextField label="City" value={city} onChangeText={setCity} placeholder="e.g. Kampala" />
        <TextField label="Country" value={country} onChangeText={setCountry} placeholder="e.g. Uganda" />

        {/* Google geospatial coordinates — optional; mandatory for satellite tags. */}
        <AppText variant="bodyLarge" style={{ fontWeight: '600', marginTop: spacing.xs, marginBottom: spacing.xs }}>
          Geospatial location{hasSatellite ? ' *' : ' (optional)'}
        </AppText>
        <Pressable
          onPress={captureCoords}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: coords ? colors.primary : colors.divider, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xs }}>
          <Icon name={coords ? 'map-marker-check' : 'map-marker-plus-outline'} size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <AppText variant="body" style={{ fontWeight: '600' }}>
              {locating ? 'Getting coordinates…' : coords ? 'Coordinates captured' : 'Capture Google coordinates'}
            </AppText>
            {coords ? (
              <AppText variant="caption" color={colors.onSurfaceVariant}>
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </AppText>
            ) : null}
          </View>
        </Pressable>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
          {hasSatellite
            ? 'A satellite device is attached — coordinates are required. Google Maps geo-fencing builds on this.'
            : 'Captures a Google coordinate for mapping & geo-fencing. Required if you add a satellite device.'}
        </AppText>

        {/* (d) Devices */}
        <SectionHeading step="d" title="Tags & devices" subtitle="Optional — an AAN can carry more than one device" />
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
                {d.linkage ? ` · ${d.linkage === 'support' ? 'Ngaren linkage' : 'Self-linkage'}` : ''}
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
        <Button label="Add device" icon="plus" variant="outline" onPress={() => setDeviceSheet(true)} />
        {devices.length === 0 ? (
          <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginTop: spacing.xs }}>
            No device — this animal is identified by its photo ID (manual/visual tag).
          </AppText>
        ) : null}

        {/* (e) Terms & conditions */}
        <SectionHeading step="e" title="Terms & conditions" />
        <Pressable onPress={() => setTcsAccepted((v) => !v)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md }}>
          <Icon name={tcsAccepted ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={tcsAccepted ? colors.primary : colors.onSurfaceVariant} />
          <AppText variant="body" color={colors.onSurface} style={{ flex: 1 }}>
            I accept the Ngaren AAN terms & conditions and confirm the information captured is accurate.
          </AppText>
        </Pressable>

        <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Any additional details..." multiline />

        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
          {autoApprove
            ? 'As the farm owner, this record is created and activated automatically.'
            : 'On submit the record is Created, then Validated, then Activated by Ngaren after a completeness check (target 48 hours). You’ll be notified once activated.'}
        </AppText>
        <Button
          label={autoApprove ? 'Create AAN' : 'Submit for activation'}
          loading={submitting}
          disabled={!canSubmit}
          onPress={onSubmit}
        />
      </Screen>

      {/* Device capture sheet (step 1d.ii/iii) */}
      <BottomSheet visible={deviceSheet} onClose={() => setDeviceSheet(false)} title="Add a device">
        <PickerField label="Device type" required value={dType} placeholder="Select a model" options={DEVICE_MODEL_OPTIONS} onSelect={setDType} />
        <TextField label="Serial number" required value={dSerial} onChangeText={setDSerial} placeholder="Device serial / ESN" />
        <TextField label="Supplier" value={dSupplier} onChangeText={setDSupplier} placeholder="Supplier name" />
        <PhotoField label="Device photo" value={dPhoto} onChange={setDPhoto} />
        {draftIsSatellite ? (
          <>
            <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
              Satellite provider linkage *
            </AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              <Button label="Request Ngaren support" variant={dLinkage === 'support' ? 'primary' : 'outline'} onPress={() => setDLinkage('support')} style={{ flex: 1 }} />
              <Button label="Self-linkage online" variant={dLinkage === 'self' ? 'primary' : 'outline'} onPress={() => setDLinkage('self')} style={{ flex: 1 }} />
            </View>
          </>
        ) : null}
        <Button label="Add device" icon="check" disabled={!canAddDevice} onPress={addDevice} />
      </BottomSheet>
    </View>
  );
}
