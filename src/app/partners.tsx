import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { getVetDirectory } from '@/data/vetDirectory';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { useT } from '@/i18n';
import { AppText, EmptyState, GradientHeader, Icon, Screen, SearchBar } from '@/ui';

type PartnerType = 'all' | 'veterinarian' | 'drug_shop';

/**
 * Approved partners — the vets and drug shops Ngaren works with, filtered by
 * type, as on the web. Vets are the live directory (the get_bookable_vets
 * function: name and rating only). There is no shared list of drug shops yet,
 * so that tab says so instead of showing made-up shops.
 */
export default function Partners() {
  const router = useRouter();
  const t = useT();
  const { loading, isAuthenticated } = useAuth();
  const { data: directory, loading: busy, reload } = useResource(getVetDirectory, []);
  const [type, setType] = useState<PartnerType>('all');
  const [query, setQuery] = useState('');

  // Only vets with a real account: the seeded list Find a Vet falls back to isn't a partner list.
  const vets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return directory.filter((v) => !!v.userId && (!q || v.name.toLowerCase().includes(q)));
  }, [directory, query]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const TYPES: PartnerType[] = ['all', 'veterinarian', 'drug_shop'];
  const showVets = type !== 'drug_shop';
  const showShops = type !== 'veterinarian';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('ap.title')} subtitle={t('ap.subtitle')} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }} refreshing={busy} onRefresh={reload}>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t('ap.search')} />
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md }}>
          {TYPES.map((p) => {
            const on = type === p;
            return (
              <Pressable
                key={p}
                onPress={() => setType(p)}
                style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.divider }}>
                <AppText variant="caption" color={on ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>{t(`ap.type.${p}`)}</AppText>
              </Pressable>
            );
          })}
        </View>

        {showVets && (
          <>
            <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>{t('ap.vets', { count: vets.length })}</AppText>
            {vets.length === 0 ? (
              <EmptyState icon="stethoscope" title={t('ap.noVetsTitle')} subtitle={t('ap.noVetsSub')} />
            ) : (
              vets.map((v) => (
                <Pressable
                  key={v.id}
                  onPress={() => router.push(`/find-vet/${v.id}` as never)}
                  style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, opacity: pressed ? 0.9 : 1 }, shadow[1]]}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="stethoscope" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{v.name}</AppText>
                    <AppText variant="caption" color={colors.onSurfaceVariant}>{t('ap.veterinarian')}</AppText>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Icon name="star" size={16} color={colors.warning} />
                    <AppText variant="body">{v.reviews > 0 ? `${v.rating.toFixed(1)} (${v.reviews})` : t('ap.noRatings')}</AppText>
                  </View>
                </Pressable>
              ))
            )}
          </>
        )}

        {showShops && (
          <>
            <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>{t('ap.shops')}</AppText>
            <EmptyState icon="pill" title={t('ap.noShopsTitle')} subtitle={t('ap.noShopsSub')} />
          </>
        )}
      </Screen>
    </View>
  );
}
