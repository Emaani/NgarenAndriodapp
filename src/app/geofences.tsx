import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { canEditFence, getGeofenceRows } from '@/data/geofences';
import { useResource } from '@/data/hooks';
import { isSupabaseConfigured } from '@/config';
import { ringAreaHa, rowRing } from '@/lib/geofenceShapes';
import { useAuth } from '@/services/auth';
import { useT } from '@/i18n';
import { ActionChip, AppText, Button, EmptyState, GradientHeader, Icon, Screen } from '@/ui';

/**
 * Geofences — the farm boundaries shared with the web command centre. Farmers
 * draw and manage their own; admins manage every boundary; vets can look.
 * The Track map checks animals against the active ones.
 */
export default function Geofences() {
  const router = useRouter();
  const t = useT();
  const { loading, isAuthenticated, user, appRole } = useAuth();
  const { data: rows, reload, loading: busy } = useResource(getGeofenceRows, []);
  useFocusEffect(useCallback(() => reload(), [reload]));

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const canCreate = appRole === 'admin' || appRole === 'farmer';
  const live = isSupabaseConfigured();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('gf.title')} subtitle={t('gf.subtitle', { count: rows.length })} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }} refreshing={busy} onRefresh={reload}>
        {canCreate && live && (
          <Button label={t('gf.new')} icon="vector-polygon" onPress={() => router.push('/geofence-edit' as never)} style={{ marginBottom: spacing.md }} />
        )}
        {!live ? (
          <EmptyState icon="vector-polygon" title={t('gf.demoTitle')} subtitle={t('gf.demoSub')} />
        ) : rows.length === 0 ? (
          <EmptyState icon="vector-polygon" title={t('gf.emptyTitle')} subtitle={canCreate ? t('gf.emptySub') : t('gf.emptySubVet')} />
        ) : (
          rows.map((r) => {
            const editable = canEditFence(r, user, appRole);
            const area = ringAreaHa(rowRing(r));
            const assigned = r.assigned_animal_ids?.length ?? 0;
            return (
              <Pressable
                key={r.id}
                onPress={() => router.push(`/geofence-edit?id=${r.id}` as never)}
                style={({ pressed }) => [
                  { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, opacity: pressed ? 0.9 : 1 },
                  shadow[1],
                ]}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: r.fence_mode === 'keep_out' ? '#d9534f' : r.color }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{r.name}</AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    {t(`gf.type.${r.fence_type}`)} · {t(r.fence_mode === 'keep_out' ? 'gf.keepOut' : 'gf.keepIn')} · {t('gf.areaHa', { ha: area.toFixed(area < 10 ? 2 : 1) })}
                  </AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    {assigned ? t('gf.assignedSome', { count: assigned }) : t('gf.assignedAll')}
                  </AppText>
                </View>
                <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                  <ActionChip label={r.active ? t('gf.active') : t('gf.paused')} variant={r.active ? 'success' : 'neutral'} />
                  <Icon name={editable ? 'pencil-outline' : 'eye-outline'} size={18} color={colors.onSurfaceVariant} />
                </View>
              </Pressable>
            );
          })
        )}
      </Screen>
    </View>
  );
}
