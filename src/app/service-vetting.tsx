import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { vets as seededVets } from '@/data/mock';
import { getEnlistedVets, VetEnlistment } from '@/data/vetEnlistments';
import { getProviderStatuses, setProviderStatus, ProviderStatus } from '@/data/localProviderStatus';
import { Vet } from '@/data/types';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { notify } from '@/lib/toast';
import { useT } from '@/i18n';
import { ActionChip, AppText, Button, EmptyState, GradientHeader, Icon, IconChip, Screen } from '@/ui';

type Filter = 'all' | ProviderStatus;
const FILTERS: Filter[] = ['all', 'pending', 'active', 'suspended'];

const statusVariant = (s: ProviderStatus) =>
  s === 'active' ? 'success' : s === 'pending' ? 'warning' : s === 'suspended' ? 'error' : 'neutral';

type Provider = Vet & { email?: string; phone?: string; city?: string; enlisted?: boolean };

/**
 * Service Provider Vetting (FR-ADM-01) — admin-exclusive. Reviews enlisted
 * service providers' credentials and moves them through the lifecycle:
 * Pending → Active (approved) → Suspended → Removed. Seeded demo vets start
 * Active; admin-enlisted providers start Pending review. In sync with the
 * Farmer/Vet apps: only Active providers should be bookable in Find-a-Vet.
 */
export default function ServiceVetting() {
  const router = useRouter();
  const t = useT();
  const { loading, isAuthenticated, isAdmin } = useAuth();
  const { data: enlisted } = useResource(getEnlistedVets, []);
  const { data: statuses, reload } = useResource(getProviderStatuses, {});
  const [local, setLocal] = useState<Record<number, ProviderStatus> | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<number | null>(null);

  const effective = local ?? statuses;

  const providers: Provider[] = useMemo(() => {
    const seeded: Provider[] = seededVets.map((v) => ({ ...v, enlisted: false }));
    const enl: Provider[] = (enlisted as VetEnlistment[]).map((v) => ({ ...v, enlisted: true }));
    return [...enl, ...seeded];
  }, [enlisted]);

  const statusOf = (p: Provider): ProviderStatus => effective[p.id] ?? (p.enlisted ? 'pending' : 'active');

  const visible = useMemo(
    () => providers.filter((p) => statusOf(p) !== 'removed' && (filter === 'all' || statusOf(p) === filter)),
    [providers, effective, filter],
  );

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/(tabs)/home" />;

  const counts = {
    pending: providers.filter((p) => statusOf(p) === 'pending').length,
    active: providers.filter((p) => statusOf(p) === 'active').length,
    suspended: providers.filter((p) => statusOf(p) === 'suspended').length,
  };

  const setStatus = async (p: Provider, status: ProviderStatus) => {
    setBusy(p.id);
    setLocal((prev) => ({ ...(prev ?? statuses), [p.id]: status }));
    await setProviderStatus(p.id, status);
    setBusy(null);
    const label = t(`sv.status.${status}`);
    notify(t('sv.updated', { name: p.name, status: label }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('sv.title')} subtitle={t('sv.subtitle', { pending: counts.pending, active: counts.active })} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {/* Status filter. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
          {FILTERS.map((f) => {
            const on = filter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.divider }}>
                <AppText variant="caption" color={on ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                  {t(`sv.filter.${f}`)}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {visible.length === 0 ? (
          <EmptyState icon="shield-account-outline" title={t('sv.emptyTitle')} subtitle={t('sv.emptySub')} />
        ) : (
          visible.map((p) => {
            const s = statusOf(p);
            return (
              <View
                key={p.id}
                style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus }}>
                  <IconChip icon="stethoscope" />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{p.name}</AppText>
                    <AppText variant="caption" color={colors.onSurfaceVariant}>{p.clinic} · {p.specialty}</AppText>
                  </View>
                  <ActionChip label={t(`sv.status.${s}`)} variant={statusVariant(s)} />
                </View>

                {/* Credentials under review. */}
                <View style={{ gap: 2 }}>
                  {p.credentials ? <CredRow icon="certificate-outline" text={p.credentials} /> : null}
                  {p.institution ? <CredRow icon="school-outline" text={p.institution} /> : null}
                  {typeof p.yearsExperience === 'number' ? <CredRow icon="clock-outline" text={t('sv.years', { n: p.yearsExperience })} /> : null}
                  {p.email ? <CredRow icon="email-outline" text={p.email} /> : null}
                  {p.city ? <CredRow icon="map-marker-outline" text={p.city} /> : null}
                  <CredRow icon="map-marker-radius" text={t('sv.radius', { km: Math.max(3, Math.round(p.distanceKm)) })} />
                </View>

                {/* Lifecycle actions. */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {s === 'pending' ? (
                    <>
                      <Button label={t('sv.approve')} icon="check-decagram-outline" loading={busy === p.id} onPress={() => setStatus(p, 'active')} style={{ flex: 1 }} />
                      <Button label={t('sv.remove')} variant="outline" onPress={() => setStatus(p, 'removed')} style={{ flex: 1 }} />
                    </>
                  ) : s === 'active' ? (
                    <>
                      <Button label={t('sv.suspend')} icon="pause-circle-outline" variant="outline" loading={busy === p.id} onPress={() => setStatus(p, 'suspended')} style={{ flex: 1 }} />
                      <Button label={t('sv.remove')} variant="outline" onPress={() => setStatus(p, 'removed')} style={{ flex: 1 }} />
                    </>
                  ) : (
                    <>
                      <Button label={t('sv.reactivate')} icon="play-circle-outline" loading={busy === p.id} onPress={() => setStatus(p, 'active')} style={{ flex: 1 }} />
                      <Button label={t('sv.remove')} variant="outline" onPress={() => setStatus(p, 'removed')} style={{ flex: 1 }} />
                    </>
                  )}
                </View>
              </View>
            );
          })
        )}

        <Button label={t('sv.enlistNew')} icon="account-plus-outline" variant="outline" onPress={() => router.push('/enlist-vet' as never)} style={{ marginTop: spacing.sm }} />
      </Screen>
    </View>
  );
}

function CredRow({ icon, text }: { icon: 'certificate-outline' | 'school-outline' | 'clock-outline' | 'email-outline' | 'map-marker-outline' | 'map-marker-radius'; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <Icon name={icon} size={14} color={colors.onSurfaceVariant} />
      <AppText variant="caption" color={colors.onSurfaceVariant}>{text}</AppText>
    </View>
  );
}
