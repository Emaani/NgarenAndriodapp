import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { colors, spacing } from '@/theme';
import { animals as animalsFallback } from '@/data/mock';
import { getHerd } from '@/data/herd';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { useT } from '@/i18n';
import { AnimalListItem, AppText, EmptyState, Fab, GradientHeader, Icon, SearchBar } from '@/ui';

/**
 * Vet livestock list — the herd view vets reach from their dashboard. The
 * farmer/admin animals list lives in the (tabs) group, which redirects vets to
 * their dashboard, so vets had no way to browse the herd. This is that list:
 * read-first clinical oversight across the animals they can see (RLS-scoped),
 * with search and tap-through to the shared animal detail (which already has
 * vet-specific actions). Vets can also start a (pending-approval) registration.
 */
export default function VetAnimals() {
  const router = useRouter();
  const t = useT();
  const { canVet, isAuthenticated, loading: authLoading } = useAuth();
  const [query, setQuery] = useState('');
  const { data: allAnimals, loading, reload } = useResource(getHerd, animalsFallback);

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

  // Hooks above; guards below so hook order stays stable.
  if (authLoading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!canVet) return <Redirect href="/(tabs)/home" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader
        showBack
        title={t('vetHerd.title')}
        subtitle={t('vetHerd.subtitle', { count: allAnimals.length })}
      />
      <View style={{ padding: spacing.md, paddingBottom: 0 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t('vetHerd.search')} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <Icon name="shield-lock-outline" size={13} color={colors.onSurfaceVariant} />
        <AppText variant="caption" color={colors.onSurfaceVariant}>
          {t('vetHerd.scopeNote')}
        </AppText>
      </View>
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
            <EmptyState icon="cow" title={t('vetHerd.emptyTitle')} subtitle={t('vetHerd.emptySub')} />
          )
        }
      />
      <Fab icon="plus" onPress={() => router.push('/register-animal')} />
    </View>
  );
}
