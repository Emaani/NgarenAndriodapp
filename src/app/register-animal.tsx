import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import {
  breeds as breedsFallback,
  devices as devicesFallback,
  locations as locationsFallback,
} from '@/data/mock';
import { getAnimals, getBreeds, getDevices, getLocations, registerAnimal } from '@/data/api';
import { addLocalAnimal, getLocalAnimals } from '@/data/localAnimals';
import { useAuth } from '@/services/auth';
import { generateNgarenCode } from '@/lib/ngaren';
import { SMART_METHODS, TAGGING_METHOD_OPTIONS, taggingMeta } from '@/lib/tagging';
import { useResource } from '@/data/hooks';
import { AppText, Button, DatePickerField, GradientHeader, PhotoField, PickerField, Screen, TextField } from '@/ui';

// Standardized quick-select colours (management decision: standardized options
// while keeping a free descriptor for unique cases).
const COMMON_COLOURS = ['Brown', 'Black', 'White', 'Brown & white', 'Black & white', 'Tan', 'Grey', 'Red'];

const UNKNOWN = '';
const EXTERNAL = '__external__';

export default function RegisterAnimal() {
  const router = useRouter();
  const { canManageTeam } = useAuth();
  const { data: breeds } = useResource(
    getBreeds,
    breedsFallback.map((name) => ({ key: name.toLowerCase(), name })),
  );
  const { data: locations } = useResource(() => getLocations(), locationsFallback);
  const { data: devices } = useResource(() => getDevices(), devicesFallback);
  const { data: herd } = useResource(async () => {
    const [remote, local] = await Promise.all([getAnimals(), getLocalAnimals()]);
    return [...local, ...remote];
  }, []);

  // Auto-generated internal identifier, minted at onboarding inception.
  const [ngarenCode] = useState(() => generateNgarenCode());

  // Inception: tagging / service selection first.
  const [taggingMethod, setTaggingMethod] = useState('');
  const [deviceSerial, setDeviceSerial] = useState('');

  const [tag, setTag] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [breedKey, setBreedKey] = useState('');
  const [locationId, setLocationId] = useState('');
  const [dob, setDob] = useState('');
  // Lineage — each parent: Unknown | a registered animal | Another farm (+ ref).
  const [damChoice, setDamChoice] = useState(UNKNOWN);
  const [damExternal, setDamExternal] = useState('');
  const [sireChoice, setSireChoice] = useState(UNKNOWN);
  const [sireExternal, setSireExternal] = useState('');
  // 360° photo ID.
  const [photoFront, setPhotoFront] = useState<string | null>(null);
  const [photoLeft, setPhotoLeft] = useState<string | null>(null);
  const [photoRight, setPhotoRight] = useState<string | null>(null);
  const [photoBack, setPhotoBack] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isSmartTag = SMART_METHODS.includes(taggingMethod as never);
  const autoApprove = canManageTeam; // owner/admin capturing their own animals

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

  const resolveParent = (choice: string, external: string): string | undefined => {
    if (choice === UNKNOWN) return undefined;
    if (choice === EXTERNAL) return external.trim() ? `Another farm: ${external.trim()}` : undefined;
    return choice;
  };

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      const breedName = breedOptions.find((b) => b.value === breedKey)?.label ?? 'Unknown';
      const locationName = locationOptions.find((l) => l.value === locationId)?.label;
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
        damTag: resolveParent(damChoice, damExternal),
        sireTag: resolveParent(sireChoice, sireExternal),
        photos,
        ngarenCode,
        color: color.trim() || undefined,
        taggingMethod: taggingMethod || 'manual',
        // Maker-checker: the farm owner acting as capturer is auto-approved
        // (their entry is its own attestation); everyone else stays pending.
        approvalStatus: autoApprove ? 'approved' : 'pending',
      });

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
        {/* Inception: the internal system ID is assigned up front. */}
        <View style={{ backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            System tag ID (auto-assigned)
          </AppText>
          <AppText variant="title" color={colors.primary} style={{ fontWeight: '700' }}>
            {ngarenCode}
          </AppText>
        </View>

        {/* Inception: tagging / service selection. */}
        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          Tagging & service
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
            Manual tag — no device is linked. The photo ID below is the animal’s record.
          </AppText>
        ) : null}

        {/* 360° Photo ID — front is the mandatory display photo. */}
        <AppText variant="title" style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}>
          360° Photo ID
        </AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          Capture front, both sides and back. The front photo is the animal’s display photo.
        </AppText>
        <PhotoField label="Front (required · display photo)" value={photoFront} onChange={setPhotoFront} />
        <PhotoField label="Left side" value={photoLeft} onChange={setPhotoLeft} />
        <PhotoField label="Right side" value={photoRight} onChange={setPhotoRight} />
        <PhotoField label="Back" value={photoBack} onChange={setPhotoBack} />

        <AppText variant="title" style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
          Details
        </AppText>
        <TextField label="Tag ID (your reference)" required value={tag} onChangeText={setTag} placeholder="e.g. A-073" />
        <TextField label="Name" value={name} onChangeText={setName} placeholder="Optional friendly name" />
        <PickerField label="Breed" required value={breedKey} placeholder="Select a breed" options={breedOptions} onSelect={setBreedKey} />

        {/* Colour: standardized quick-select chips + free descriptor. */}
        <TextField label="Colour / markings" value={color} onChangeText={setColor} placeholder="e.g. Brown with white patch" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: -spacing.sm, marginBottom: spacing.md }}>
          {COMMON_COLOURS.map((c) => {
            const active = color.trim().toLowerCase() === c.toLowerCase();
            return (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={{
                  paddingHorizontal: spacing.mdMinus,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.full,
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.divider,
                }}>
                <AppText variant="caption" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                  {c}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <PickerField label="Location" required value={locationId} placeholder="Select a location" options={locationOptions} onSelect={setLocationId} />
        <DatePickerField label="Date of Birth" value={dob} placeholder="Select date of birth" maximumIso={today} onSelect={setDob} />

        {/* Lineage — Unknown / in database / another farm, per parent. */}
        <AppText variant="title" style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
          Lineage
        </AppText>
        <PickerField label="Dam (mother)" value={damChoice} placeholder="Unknown" options={parentOptions} onSelect={setDamChoice} />
        {damChoice === EXTERNAL ? (
          <TextField label="Dam reference (another farm)" value={damExternal} onChangeText={setDamExternal} placeholder="e.g. tag or farm name" />
        ) : null}
        <PickerField label="Sire (father)" value={sireChoice} placeholder="Unknown" options={parentOptions} onSelect={setSireChoice} />
        {sireChoice === EXTERNAL ? (
          <TextField label="Sire reference (another farm)" value={sireExternal} onChangeText={setSireExternal} placeholder="e.g. tag or farm name" />
        ) : null}

        <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Any additional details..." multiline />

        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
          {autoApprove
            ? 'As the farm owner, your entries are approved automatically.'
            : 'Fields marked * are required. Saved as pending until the farm owner approves.'}
        </AppText>
        <Button
          label={autoApprove ? 'Register animal' : 'Submit for approval'}
          loading={submitting}
          disabled={!tag.trim() || !breedKey || !locationId || !taggingMethod || !photoFront}
          onPress={onSubmit}
        />
      </Screen>
    </View>
  );
}
