import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import { animals as animalsFallback } from '@/data/mock';
import { getAnimals } from '@/data/api';
import { getLocalAnimals } from '@/data/localAnimals';
import { useResource } from '@/data/hooks';
import { AnimalListItem, EmptyState, Fab, GradientHeader, NotificationBell, Screen, SearchBar } from '@/ui';

export default function AnimalsTab() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  // Locally-onboarded animals (with their photo IDs) sit on top of the backend
  // herd so a freshly registered animal appears immediately.
  const { data: allAnimals } = useResource(async () => {
    const [remote, local] = await Promise.all([getAnimals(), getLocalAnimals()]);
    return [...local, ...remote];
  }, animalsFallback);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return allAnimals.filter(
      (a) =>
        a.tag.toLowerCase().includes(q) ||
        (a.name ?? '').toLowerCase().includes(q) ||
        a.breed.name.toLowerCase().includes(q),
    );
  }, [allAnimals, query]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Your animals" subtitle={`${allAnimals.length} registered`} right={<NotificationBell />} />
      <View style={{ padding: spacing.md, paddingBottom: 0 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search by tag, name or breed..." />
      </View>
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {filtered.length === 0 ? (
          <EmptyState icon="cow" title="No animals found" subtitle="Register an animal to get started." />
        ) : (
          filtered.map((a) => (
            <AnimalListItem
              key={a.id}
              animal={a}
              onPress={() => router.push(`/animals/${a.id}`)}
              onMenu={() => router.push(`/animals/${a.id}`)}
            />
          ))
        )}
      </Screen>
      <Fab icon="plus" onPress={() => router.push('/register-animal')} />
    </View>
  );
}
