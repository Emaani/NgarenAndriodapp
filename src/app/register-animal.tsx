import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import {
  breeds as breedsFallback,
  devices as devicesFallback,
  locations as locationsFallback,
} from '@/data/mock';
import { getAnimals, getBreeds, getDevices, getLocations, registerAnimal } from '@/data/api';
import { addLocalAnimal, getLocalAnimals } from '@/data/localAnimals';
import { generateNgarenCode } from '@/lib/ngaren';
import { SMART_METHODS, TAGGING_METHOD_OPTIONS, taggingMeta } from '@/lib/tagging';
import { useResource } from '@/data/hooks';
import { AppText, Button, DatePickerField, GradientHeader, PhotoField, PickerField, Screen, TextField } from '@/ui';

export default function RegisterAnimal() {
  const router = useRouter();
  const { data: breeds } = useResource(
    getBreeds,
    breedsFallback.map((name) => ({ key: name.toLowerCase(), name })),
  );
  const { data: locations } = useResource(() => getLocations(), locationsFallback);
  const { data: devices } = useResource(() => getDevices(), devicesFallback);
  // Registered animals feed the lineage dropdowns (dam/sire).
  const { data: herd } = useResource(async () => {
    const [remote, local] = await Promise.all([getAnimals(), getLocalAnimals()]);
    return [...local, ...remote];
  }, []);

  const [tag, setTag] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [breedKey, setBreedKey] = useState('');
  const [locationId, setLocationId] = useState('');
  const [dob, setDob] = useState('');
  const [damTag, setDamTag] = useState('');
  const [sireTag, setSireTag] = useState('');
  const [taggingMethod, setTaggingMethod] = useState('');
  const [deviceSerial, setDeviceSerial] = useState('');
  // 360° photo ID: front is the primary; left/right/back complete the record.
  const [photoFront, setPhotoFront] = useState<string | null>(null);
  const [photoLeft, setPhotoLeft] = useState<string | null>(null);
  const [photoRight, setPhotoRight] = useState<string | null>(null);
  const [photoBack, setPhotoBack] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isSmartTag = SMART_METHODS.includes(taggingMethod as never);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const breedOptions = useMemo(() => breeds.map((b) => ({ label: b.name, value: b.key })), [breeds]);
  const locationOptions = useMemo(
    () => locations.map((l) => ({ label: l.name, value: String(l.id) })),
    [locations],
  );
  const deviceOptions = useMemo(
    () =>
      devices
        .filter((d) => d.linkedAnimalId === null && d.linkedAnimalTag === null)
        .map((d) => ({ label: `${d.serial} · ${d.model}`, value: d.serial })),
    [devices],
  );
  // Lineage: choose a registered parent, or leave "Unknown".
  const parentOptions = useMemo(
    () => [
      { label: 'Unknown', value: '' },
      ...herd.map((a) => ({ label: `${a.name ?? a.tag} · ${a.tag}`, value: a.tag })),
    ],
    [herd],
  );

  const photos = useMemo(
    () => [photoFront, photoLeft, photoRight, photoBack].filter((p): p is string => !!p),
    [photoFront, photoLeft, photoRight, photoBack],
  );

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      const breedName = breedOptions.find((b) => b.value === breedKey)?.label ?? 'Unknown';
      const locationName = locationOptions.find((l) => l.value === locationId)?.label;
      // Dual ID: an immutable system-generated NGR code + the user's custom tag.
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
        description: notes.trim() || undefined,
        deviceSerial: deviceSerial || null,
        damTag: damTag || undefined,
        sireTag: sireTag || undefined,
        photos,
        ngarenCode,
        color: color.trim() || undefined,
        taggingMethod: taggingMethod || 'manual',
        // Maker-checker: a new registration is captured as pending until an
        // approver signs it off.
        approvalStatus: 'pending',
      });

      // Best-effort backend persist (no-op in mock mode); never blocks onboarding.
      try {
        await registerAnimal({
          tag,
          breedKey: breedKey || undefined,
          locationId: locationId ? Number(locationId) : undefined,
          dateOfBirth: dob || null,
          description: notes.trim() || `Tagging: ${taggingMeta(taggingMethod).label}`,
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
        {/* 360° Photo ID leads the form — it's the animal's primary identifier. */}
        <AppText variant="title" style={{ marginBottom: spacing.xs }}>
          360° Photo ID
        </AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          Capture the animal from four angles. The front photo is its primary ID.
        </AppText>
        <PhotoField label="Front (required)" value={photoFront} onChange={setPhotoFront} />
        <PhotoField label="Left side" value={photoLeft} onChange={setPhotoLeft} />
        <PhotoField label="Right side" value={photoRight} onChange={setPhotoRight} />
        <PhotoField label="Back" value={photoBack} onChange={setPhotoBack} />

        <AppText variant="title" style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
          Details
        </AppText>
        <TextField label="Tag ID (your reference)" required value={tag} onChangeText={setTag} placeholder="e.g. A-073" />
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}>
          A permanent Ngaren code (NGR-…) is generated automatically as the system ID.
        </AppText>
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

        {/* Lineage — select a registered parent or leave Unknown. */}
        <AppText variant="title" style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
          Lineage
        </AppText>
        <PickerField label="Dam (mother)" value={damTag} placeholder="Unknown" options={parentOptions} onSelect={setDamTag} />
        <PickerField label="Sire (father)" value={sireTag} placeholder="Unknown" options={parentOptions} onSelect={setSireTag} />

        <AppText variant="title" style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
          Tagging
        </AppText>
        <PickerField
          label="Tagging method"
          required
          value={taggingMethod}
          placeholder="How is this animal tagged?"
          options={TAGGING_METHOD_OPTIONS}
          onSelect={(v) => {
            setTaggingMethod(v);
            if (!SMART_METHODS.includes(v as never)) setDeviceSerial('');
          }}
        />

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
          Fields marked * are required. The record is saved as pending until approved.
        </AppText>
        <Button
          label="Submit for approval"
          loading={submitting}
          disabled={!tag.trim() || !breedKey || !locationId || !taggingMethod || !photoFront}
          onPress={onSubmit}
        />
      </Screen>
    </View>
  );
}
