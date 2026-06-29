import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import { breeds as breedsFallback, locations as locationsFallback } from '@/data/mock';
import { getBreeds, getLocations, registerAnimal } from '@/data/api';
import { useResource } from '@/data/hooks';
import { AppText, Button, GradientHeader, Screen, SelectField, TextField } from '@/ui';

export default function RegisterAnimal() {
  const router = useRouter();
  const { data: breeds } = useResource(
    getBreeds,
    breedsFallback.map((name) => ({ key: name.toLowerCase(), name })),
  );
  const { data: locations } = useResource(() => getLocations(), locationsFallback);

  const [tag, setTag] = useState('');
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [location, setLocation] = useState('');
  const [dob, setDob] = useState('');
  const [device, setDevice] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const cycle = (current: string, options: string[], set: (v: string) => void) => {
    if (options.length === 0) return;
    const idx = options.indexOf(current);
    set(options[(idx + 1) % options.length]);
  };

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      // Persists when the backend is configured; resolves to null in mock mode,
      // keeping the existing offline UX intact.
      await registerAnimal({
        tag,
        breedKey: breeds.find((b) => b.name === breed)?.key,
        locationId: locations.find((l) => l.name === location)?.id,
        dateOfBirth: dob || null,
        description: notes || name || undefined,
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
        <SelectField
          label="Breed"
          required
          value={breed}
          placeholder="Select a breed"
          onPress={() => cycle(breed, breeds.map((b) => b.name), setBreed)}
        />
        <SelectField
          label="Location"
          required
          value={location}
          placeholder="Select a location"
          onPress={() => cycle(location, locations.map((l) => l.name), setLocation)}
        />
        <SelectField label="Date of Birth" value={dob} placeholder="YYYY-MM-DD" icon="calendar" onPress={() => setDob('2024-01-15')} />
        <SelectField
          label="Link a Device"
          value={device}
          placeholder="Scan or select a tag"
          icon="tag"
          onPress={() => setDevice('CRS-00231')}
        />
        <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Any additional details..." multiline />

        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
          Fields marked * are required.
        </AppText>
        <Button label="Register Animal" loading={submitting} onPress={onSubmit} />
      </Screen>
    </View>
  );
}
