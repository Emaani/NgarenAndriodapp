import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { colors, spacing } from '@/theme';
import { animals as animalsFallback } from '@/data/mock';
import { getHerd } from '@/data/herd';
import { pendingSyncCount, processSyncQueue } from '@/data/syncQueue';
import { useResource } from '@/data/hooks';
import { AnimalListItem, EmptyState, Fab, GradientHeader, NotificationBell, SearchBar } from '@/ui';

export default function AnimalsTab() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  // Live herd from Supabase animal_lineage, with locally-onboarded animals on top.
  const { data: allAnimals, loading, reload } = useResource(getHerd, animalsFallback);

  // Show how many registrations are still waiting to sync to Supabase, and keep
  // nudging the queue while this screen is open.
  const [pending, setPending] = useState(0);
  useEffect(() => {
    let active = true;
    const tick = async () => {
      void processSyncQueue();
      const n = await pendingSyncCount();
      if (active) setPending(n);
    };
    void tick();
    const t = setInterval(tick, 5000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

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
      <GradientHeader
        title="Your animals"
        subtitle={pending > 0 ? `${allAnimals.length} registered · ${pending} syncing…` : `${allAnimals.length} registered`}
        right={<NotificationBell />}
      />
      <View style={{ padding: spacing.md, paddingBottom: 0 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search by tag, name or breed..." />
      </View>
      {/* Virtualized herd list — scales to large herds; pull to refresh. */}
      <FlashList
        data={filtered}
        keyExtractor={(a) => String(a.id)}
        renderItem={({ item }) => (
          <AnimalListItem
            animal={item}
            onPress={() => router.push(`/animals/${item.id}`)}
            onMenu={() => router.push(`/animals/${item.id}`)}
          />
        )}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingVertical: spacing.xxl }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <EmptyState icon="cow" title="No animals found" subtitle="Register an animal to get started." />
          )
        }
      />
      <Fab icon="plus" onPress={() => router.push('/register-animal')} />
    </View>
  );
}
