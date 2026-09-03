import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { colors, radius, spacing } from '@/theme';
import { animals as animalsFallback } from '@/data/mock';
import { getHerd } from '@/data/herd';
import { failedSyncCount, pendingSyncCount, processSyncQueue, syncNow } from '@/data/syncQueue';
import { useResource } from '@/data/hooks';
import { AnimalListItem, AppText, EmptyState, Fab, GradientHeader, Icon, NotificationBell, SearchBar } from '@/ui';

export default function AnimalsTab() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  // Live herd from Supabase animal_lineage, with locally-onboarded animals on top.
  const { data: allAnimals, loading, reload } = useResource(getHerd, animalsFallback);

  // Show how many registrations are still waiting to sync to Supabase, and keep
  // nudging the queue while this screen is open.
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const refreshCounts = async () => {
    setPending(await pendingSyncCount());
    setFailed(await failedSyncCount());
  };
  useEffect(() => {
    let active = true;
    const tick = async () => {
      void processSyncQueue();
      const [p, f] = [await pendingSyncCount(), await failedSyncCount()];
      if (active) {
        setPending(p);
        setFailed(f);
      }
    };
    void tick();
    const t = setInterval(tick, 5000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  // Manual "sync now" — drains the queue including any dead-lettered writes.
  const onSyncNow = async () => {
    setSyncing(true);
    try {
      await syncNow();
      await refreshCounts();
      reload();
    } finally {
      setSyncing(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return allAnimals.filter(
      (a) =>
        (a.accountNumber ?? '').toLowerCase().includes(q) ||
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
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search by account #, tag, name or breed..." />
      </View>
      {/* Sync status + manual trigger. Failed writes are never dropped — they
          park here until a manual retry succeeds. */}
      {pending > 0 ? (
        <Pressable
          onPress={onSyncNow}
          disabled={syncing}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.md, marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: failed > 0 ? colors.errorTint : colors.primaryTint, borderWidth: 1, borderColor: failed > 0 ? colors.error + '55' : colors.primary + '33' }}>
          <Icon name={syncing ? 'sync' : failed > 0 ? 'cloud-alert' : 'cloud-sync-outline'} size={16} color={failed > 0 ? colors.error : colors.primary} />
          <AppText variant="caption" color={failed > 0 ? colors.error : colors.primary} style={{ flex: 1, fontWeight: '600' }}>
            {syncing
              ? 'Syncing…'
              : failed > 0
                ? `${failed} write${failed === 1 ? '' : 's'} failed to sync — tap to retry`
                : `${pending} write${pending === 1 ? '' : 's'} pending — tap to sync now`}
          </AppText>
        </Pressable>
      ) : null}
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
