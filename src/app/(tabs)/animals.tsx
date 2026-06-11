import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import { animals as allAnimals } from '@/data/mock';
import { AnimalListItem, EmptyState, Fab, GradientHeader, Screen, SearchBar } from '@/ui';

export default function AnimalsTab() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return allAnimals.filter(
      (a) =>
        a.tag.toLowerCase().includes(q) ||
        (a.name ?? '').toLowerCase().includes(q) ||
        a.breed.name.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Your animals" subtitle={`${allAnimals.length} registered`} />
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
