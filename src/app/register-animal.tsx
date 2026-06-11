import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import { breeds, locations } from '@/data/mock';
import { AppText, Button, GradientHeader, Screen, SelectField, TextField } from '@/ui';

export default function RegisterAnimal() {
  const router = useRouter();
  const [tag, setTag] = useState('');
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [location, setLocation] = useState('');
  const [dob, setDob] = useState('');
  const [device, setDevice] = useState('');
  const [notes, setNotes] = useState('');

  const cycle = (current: string, options: string[], set: (v: string) => void) => {
    const idx = options.indexOf(current);
    set(options[(idx + 1) % options.length]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Register Animal" subtitle="Add a new animal to your herd" showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <TextField label="Tag ID" required value={tag} onChangeText={setTag} placeholder="e.g. A-073" />
        <TextField label="Name" value={name} onChangeText={setName} placeholder="Optional friendly name" />
        <SelectField label="Breed" required value={breed} placeholder="Select a breed" onPress={() => cycle(breed, breeds, setBreed)} />
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
        <Button label="Register Animal" onPress={() => router.replace('/(tabs)/animals')} />
      </Screen>
    </View>
  );
}
