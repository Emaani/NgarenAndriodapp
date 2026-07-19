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
  const [breedKey, setBreedKey] = useState('');
  const [locationId, setLocationId] = useState('');
  const [dob, setDob] = useState('');
  const [taggingMethod, setTaggingMethod] = useState('');
  const [deviceSerial, setDeviceSerial] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
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

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      // Persists when the backend is configured; resolves to null in mock mode,
      // keeping the existing offline UX intact.
      // Fold the tagging method (and name) into the description until the
      // backend exposes dedicated fields; the photo URI is captured locally.
      const methodLabel = TAGGING_METHODS.find((m) => m.value === taggingMethod)?.label;
      const descriptionParts = [name, methodLabel ? `Tagging: ${methodLabel}` : ''].filter(Boolean);
      await registerAnimal({
        tag,
        breedKey: breedKey || undefined,
        locationId: locationId ? Number(locationId) : undefined,
        dateOfBirth: dob || null,
        description: notes || descriptionParts.join(' · ') || undefined,
      });
      router.replace('/(tabs)/animals');
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Register Animal" subtitle="Add a new animal to your herd" showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
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

        <PhotoField label="Animal photo" value={photo} onChange={setPhoto} />

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
            Manual tag — no device is linked. The photo above serves as the visual record.
          </AppText>
        ) : null}

        <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Any additional details..." multiline />

        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
          Fields marked * are required.
        </AppText>
        <Button
          label="Register Animal"
          loading={submitting}
          disabled={!tag.trim() || !breedKey || !locationId || !taggingMethod}
          onPress={onSubmit}
        />
      </Screen>
    </View>
  );
}
