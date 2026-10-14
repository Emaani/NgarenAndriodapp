import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { FarmerPortfolioItem, getFarmerPortfolio, portfolioTotals } from '@/data/portfolio';
import { getLocalFarmers, setLocalFarmerActive } from '@/data/localFarmers';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { notify } from '@/lib/toast';
import { useT, useTStatus } from '@/i18n';
import { ActionChip, AppText, Button, EmptyState, GradientHeader, Icon, IconChip, Screen, SearchBar } from '@/ui';

const isLocalFarmer = (id: string) => id.startsWith('lf-');

const STATUS_VARIANT = {
  active: 'success' as const,
  attention: 'warning' as const,
  inactive: 'neutral' as const,
};

function TotalTile({ value, label, tint }: { value: number; label: string; tint: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <AppText variant="headline" color="#fff">
        {value}
      </AppText>
      <AppText variant="caption" color="rgba(255,255,255,0.9)" style={{ textAlign: 'center' }}>
        {label}
      </AppText>
    </View>
  );
}

export default function Farmers() {
  const router = useRouter();
  const t = useT();
  const tStatus = useTStatus();
  const { isAdmin, loading, isAuthenticated } = useAuth();
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>();
  const { data: portfolio } = useResource(getFarmerPortfolio, []);
  const { data: localFarmers, reload } = useResource(getLocalFarmers, []);
  const [query, setQuery] = useState('');
  const [localOverride, setLocalOverride] = useState<Record<string, boolean> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Admin-added farmers sit on top of the portfolio; activation status can be
  // toggled optimistically before the store round-trips.
  const merged: FarmerPortfolioItem[] = useMemo(() => {
    const local = localFarmers.map((f) =>
      localOverride && f.id in localOverride ? { ...f, status: (localOverride[f.id] ? 'active' : 'inactive') as FarmerPortfolioItem['status'] } : f,
    );
    return [...local, ...portfolio];
  }, [localFarmers, portfolio, localOverride]);

  const totals = useMemo(() => portfolioTotals(merged), [merged]);
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return merged
      .filter((f) => (filterParam === 'attention' ? f.status !== 'active' : true))
      .filter(
        (f) =>
          f.farmerName.toLowerCase().includes(q) ||
          f.farmName.toLowerCase().includes(q) ||
          f.location.toLowerCase().includes(q),
      );
  }, [merged, query, filterParam]);

  const activate = async (id: string) => {
    setBusy(id);
    setLocalOverride((prev) => ({ ...(prev ?? {}), [id]: true }));
    await setLocalFarmerActive(id, true);
    setBusy(null);
    notify(t('farmers.activated'));
    reload();
  };

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/(tabs)/home" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('action.farmersPortfolio')} subtitle={t('farmers.subtitle')} showBack>
        <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
          <TotalTile value={totals.farmers} label={t('home.stat.farmers')} tint="#fff" />
          <TotalTile value={totals.animals} label={t('home.stat.animals')} tint="#fff" />
          <TotalTile value={totals.activeTags} label={t('home.kpi.activeTags')} tint="#fff" />
          <TotalTile value={totals.needAttention} label={t('home.kpi.needAttention')} tint="#fff" />
        </View>
      </GradientHeader>

      <View style={{ padding: spacing.md, paddingBottom: 0 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t('farmers.search')} />
      </View>

      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <Button
          label={t('farmers.addFarmer')}
          icon="account-plus-outline"
          onPress={() => router.push('/add-farmer' as never)}
          style={{ marginBottom: spacing.md }}
        />
        {filtered.length === 0 ? (
          <EmptyState icon="account-search-outline" title={t('farmers.emptyTitle')} subtitle={t('farmers.emptySub')} />
        ) : (
          filtered.map((f: FarmerPortfolioItem) => {
            const tagPct = f.devices > 0 ? Math.round((f.activeTags / f.devices) * 100) : 0;
            return (
              <View
                key={f.id}
                style={[
                  { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, borderWidth: 1, borderColor: colors.divider },
                  shadow[1],
                ]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus }}>
                  <IconChip icon="account-tie-outline" />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                      {f.farmerName}
                    </AppText>
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      {[f.farmName, f.location].filter((s) => s && s !== '—').join(' · ') || t('farmers.noFarmDetails')}
                    </AppText>
                  </View>
                  <ActionChip label={tStatus(f.status)} variant={STATUS_VARIANT[f.status]} />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Metric icon="cow" label={t('farmers.animals')} value={String(f.animals)} />
                  <Metric icon="tag" label={t('farmers.devices')} value={String(f.devices)} />
                  <Metric icon="access-point" label={t('home.kpi.activeTags')} value={`${f.activeTags} (${tagPct}%)`} />
                  <Metric icon="heart-pulse" label={t('farmers.health')} value={f.healthScore ? `${f.healthScore}%` : '—'} />
                </View>

                {/* Admin-added farmer awaiting activation (maker-checker parity). */}
                {isLocalFarmer(f.id) && f.status !== 'active' ? (
                  <Button
                    label={t('farmers.activate')}
                    icon="check-decagram-outline"
                    loading={busy === f.id}
                    onPress={() => activate(f.id)}
                    style={{ marginTop: spacing.xs }}
                  />
                ) : (
                  <Pressable
                    onPress={() => router.push(`/admin-mirror/${f.id}` as never)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.divider, marginTop: spacing.xs }}>
                    <Icon name="eye-outline" size={14} color={colors.primary} />
                    <AppText variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>
                      {t('farmers.viewAsFarmer')}
                    </AppText>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </Screen>
    </View>
  );
}

function Metric({ icon, label, value }: { icon: 'cow' | 'tag' | 'access-point' | 'heart-pulse'; label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2, flex: 1 }}>
      <Icon name={icon} size={16} color={colors.onSurfaceVariant} />
      <AppText variant="body" style={{ fontWeight: '700' }}>
        {value}
      </AppText>
      <AppText variant="caption" color={colors.onSurfaceVariant}>
        {label}
      </AppText>
    </View>
  );
}
