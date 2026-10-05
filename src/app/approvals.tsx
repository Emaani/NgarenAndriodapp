import { useState } from 'react';
import { Image, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { Animal } from '@/data/types';
import { getPendingLocalAnimals, setLocalAnimalApproval } from '@/data/localAnimals';
import { setLineageApproval } from '@/data/herd';
import { notify } from '@/lib/toast';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { ageFromDate } from '@/lib/date';
import { taggingMeta } from '@/lib/tagging';
import { useT } from '@/i18n';
import { AppText, Button, EmptyState, GradientHeader, Icon, IconChip, Screen } from '@/ui';

/**
 * Maker-checker approvals — the "checker" step. A designated approver (owner or
 * admin) reviews animals captured by a maker and approves or rejects each before
 * the record is finalised. Data integrity per the management decision.
 */
export default function Approvals() {
  const router = useRouter();
  const t = useT();
  const { loading, isAuthenticated, canManageTeam, can } = useAuth();
  const { data: pending, reload } = useResource(getPendingLocalAnimals, []);
  const [local, setLocal] = useState<Animal[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  // Field-Operations validators (owner / admin / delegated approver) review here.
  const canApprove = canManageTeam || can('approve_records');

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!canApprove) return <Redirect href="/(tabs)/home" />;

  const items = local ?? pending;

  const decide = async (animal: Animal, status: 'approved' | 'rejected') => {
    setBusy(animal.id);
    setLocal((prev) => (prev ?? pending).filter((a) => a.id !== animal.id));
    await setLocalAnimalApproval(animal.id, status);
    // Sync the checker's decision to animal_lineage so the web command centre
    // sees the finalised animal. Best-effort — a local approval still stands.
    await setLineageApproval(animal.ngarenCode, status);
    setBusy(null);
    const who = animal.name ?? animal.tag;
    notify(status === 'approved' ? t('approvals.activated', { name: who }) : t('approvals.rejected', { name: who }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('approvals.title')} subtitle={t('approvals.subtitle', { count: items.length })} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {items.length === 0 ? (
          <EmptyState
            icon="check-decagram-outline"
            title={t('approvals.emptyTitle')}
            subtitle={t('approvals.emptySub')}
            actionLabel={t('common.refresh')}
            onAction={reload}
          />
        ) : (
          items.map((a) => {
            const meta = taggingMeta(a.taggingMethod);
            return (
              <View
                key={a.id}
                style={[
                  { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, borderWidth: 1, borderColor: colors.divider },
                  shadow[1],
                ]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus }}>
                  {a.photos?.[0] ? (
                    <Image source={{ uri: a.photos[0] }} style={{ width: 48, height: 48, borderRadius: radius.md }} />
                  ) : (
                    <IconChip icon="cow" />
                  )}
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                      {a.name ?? a.tag}
                    </AppText>
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      {a.ngarenCode ?? a.tag} · {a.breed.name}
                    </AppText>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Icon name={meta.icon} size={16} color={colors.onSurfaceVariant} />
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      {meta.short}
                    </AppText>
                  </View>
                </View>
                <AppText variant="caption" color={colors.onSurfaceVariant}>
                  {t('approvals.rowMeta', { tag: a.tag, color: a.color ?? '—', location: a.locationName ?? '—', age: ageFromDate(a.dateOfBirth), photos: a.photos?.length ?? 0 })}
                </AppText>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button label={t('approvals.activate')} icon="check" loading={busy === a.id} onPress={() => decide(a, 'approved')} style={{ flex: 1 }} />
                  <Button label={t('approvals.reject')} variant="outline" onPress={() => decide(a, 'rejected')} style={{ flex: 1 }} />
                </View>
              </View>
            );
          })
        )}
      </Screen>
    </View>
  );
}
