import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import {
  breeds as breedsFallback,
  devices as devicesFallback,
  locations as locationsFallback,
} from '@/data/mock';
import { getBreeds, getDevices, getLocations, registerAnimal } from '@/data/api';
import { addLocalAnimal } from '@/data/localAnimals';
import { generateNgarenCode } from '@/lib/ngaren';
import { useResource } from '@/data/hooks';
import { AppText, Button, DatePickerField, GradientHeader, PhotoField, PickerField, Screen, TextField } from '@/ui';

// Not every animal carries a smart tag — capture the tagging method so
// non-smart / manual tagging is supported (tester feedback).
const TAGGING_METHODS = [
  { label: 'Satellite tag (Ceres Tag)', value: 'satellite' },
  { label: 'Bluetooth (BLE) tag', value: 'bluetooth' },
  { label: 'QR-code ear tag', value: 'qr' },
  { label: 'Manual / visual tag (no device)', value: 'manual' },
];
const SMART_METHODS = ['satellite', 'bluetooth', 'qr'];

export default function RegisterAnimal() {
  const router = useRouter();
  const { data: breeds } = useResource(
    getBreeds,
    breedsFallback.map((name) => ({ key: name.toLowerCase(), name })),
  );
  const { data: locations } = useResource(() => getLocations(), locationsFallback);
  const { data: devices } = useResource(() => getDevices(), devicesFallback);

  const [tag, setTag] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [breedKey, setBreedKey] = useState('');
  const [locationId, setLocationId] = useState('');
  const [dob, setDob] = useState('');
  const [taggingMethod, setTaggingMethod] = useState('');
  const [deviceSerial, setDeviceSerial] = useState('');
  // Photo-first identity (Horizon One): front is the primary ID; side & back
  // are supporting angles.
  const [photoFront, setPhotoFront] = useState<string | null>(null);
  const [photoSide, setPhotoSide] = useState<string | null>(null);
  const [photoBack, setPhotoBack] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isSmartTag = SMART_METHODS.includes(taggingMethod);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const breedOptions = useMemo(() => breeds.map((b) => ({ label: b.name, value: b.key })), [breeds]);
  const locationOptions = useMemo(
    () => locations.map((l) => ({ label: l.name, value: String(l.id) })),
    [locations],
  );
  // Only devices not already linked to an animal can be attached here.
  const deviceOptions = useMemo(
    () =>
      devices
        .filter((d) => d.linkedAnimalId === null && d.linkedAnimalTag === null)
        .map((d) => ({ label: `${d.serial} · ${d.model}`, value: d.serial })),
    [devices],
  );

  const photos = useMemo(
    () => [photoFront, photoSide, photoBack].filter((p): p is string => !!p),
    [photoFront, photoSide, photoBack],
  );

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      const methodLabel = TAGGING_METHODS.find((m) => m.value === taggingMethod)?.label;
      const descriptionParts = [name, methodLabel ? `Tagging: ${methodLabel}` : ''].filter(Boolean);

      // Onboard locally first so the animal — with its photo ID — reliably
      // appears in the herd and its digital record, even before the animal
      // backend is wired.
      const breedName = breedOptions.find((b) => b.value === breedKey)?.label ?? 'Unknown';
      const locationName = locationOptions.find((l) => l.value === locationId)?.label;
      // Mint the animal's permanent Ngaren Asset Code at capture — its primary
      // key, independent of any tag/device.
      const ngarenCode = generateNgarenCode();
      await addLocalAnimal({
        id: Date.now(),
        tag: tag.trim(),
        name: name.trim() || undefined,
        breed: { key: breedKey || 'unknown', name: breedName },
        locationId: locationId ? Number(locationId) : undefined,
        locationName,
        dateOfBirth: dob || '',
        status: 'active',
        description: notes || descriptionParts.join(' · ') || undefined,
        deviceSerial: deviceSerial || null,
        photos,
        ngarenCode,
        color: color.trim() || undefined,
      });

      // Best-effort backend persist (no-op in mock mode); never blocks onboarding.
      try {
        await registerAnimal({
          tag,
          breedKey: breedKey || undefined,
          locationId: locationId ? Number(locationId) : undefined,
          dateOfBirth: dob || null,
          description: notes || descriptionParts.join(' · ') || undefined,
        });
      } catch {
        // ignore — the animal is already saved locally
      }

      router.replace('/(tabs)/animals');
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Register Animal" subtitle="Add a new animal to your herd" showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {/* Photo ID leads the form — it's the animal's primary identifier. */}
        <AppText variant="title" style={{ marginBottom: spacing.xs }}>
          Photo ID
        </AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          Capture the animal from three angles. The front photo is its primary ID.
        </AppText>
        <PhotoField label="Front (required)" value={photoFront} onChange={setPhotoFront} />
        <PhotoField label="Side" value={photoSide} onChange={setPhotoSide} />
        <PhotoField label="Back" value={photoBack} onChange={setPhotoBack} />

        <AppText variant="title" style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
          Details
        </AppText>
        <TextField label="Tag ID" required value={tag} onChangeText={setTag} placeholder="e.g. A-073" />
        <TextField label="Name" value={name} onChangeText={setName} placeholder="Optional friendly name" />
        <PickerField
          label="Breed"
          required
          value={breedKey}
          placeholder="Select a breed"
          options={breedOptions}
          onSelect={setBreedKey}
        />
        <TextField label="Colour / markings" value={color} onChangeText={setColor} placeholder="e.g. Brown with white patch" />
        <PickerField
          label="Location"
          required
          value={locationId}
          placeholder="Select a location"
          options={locationOptions}
          onSelect={setLocationId}
        />
        <DatePickerField
          label="Date of Birth"
          value={dob}
          placeholder="Select date of birth"
          maximumIso={today}
          onSelect={setDob}
        />

        <PickerField
          label="Tagging method"
          required
          value={taggingMethod}
          placeholder="How is this animal tagged?"
          options={TAGGING_METHODS}
          onSelect={(v) => {
            setTaggingMethod(v);
            if (!SMART_METHODS.includes(v)) setDeviceSerial('');
          }}
        />

        {/* Only smart tags link to a device on the account. Manual / visual
            tags are recorded without a device (tester feedback). */}
        {isSmartTag ? (
          <PickerField
            label="Link a Device"
            value={deviceSerial}
            placeholder={deviceOptions.length ? 'Select an available tag' : 'No unlinked devices'}
            options={deviceOptions}
            onSelect={setDeviceSerial}
          />
        ) : taggingMethod === 'manual' ? (
          <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
            Manual tag — no device is linked. The photo ID above is the animal’s record.
          </AppText>
        ) : null}

        <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Any additional details..." multiline />

        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
          Fields marked * are required.
        </AppText>
        <Button
          label="Register Animal"
          loading={submitting}
          disabled={!tag.trim() || !breedKey || !locationId || !taggingMethod || !photoFront}
          onPress={onSubmit}
        />
      </Screen>
    </View>
  );
}
