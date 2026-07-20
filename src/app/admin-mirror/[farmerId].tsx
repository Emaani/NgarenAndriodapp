import { useEffect, useRef } from 'react';
import { Image, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { FarmerMirror, getFarmerMirror, logMirrorAccess } from '@/data/farmerMirror';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { ActionChip, AppText, EmptyState, GradientHeader, Icon, IconChip, Screen } from '@/ui';

const FALLBACK: FarmerMirror = { farmer: null, animals: [], devices: [] };

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.divider }}>
      <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>
        {value}
      </AppText>
      <AppText variant="caption" color={colors.onSurfaceVariant}>
        {label}
      </AppText>
    </View>
  );
}

/**
 * Support Mirror Mode (read-only) — a snapshot of one farmer's herd and
 * devices for admin support/verification. Every view is audit-logged to
 * livestock_audit_log, exactly like the web AdminFarmerMirrorPage.
 */
export default function AdminMirror() {
  const { farmerId } = useLocalSearchParams<{ farmerId: string }>();
  const { loading, isAuthenticated, isAdmin, user } = useAuth();
  const { data: mirror, loading: loadingMirror } = useResource(() => getFarmerMirror(farmerId), FALLBACK);
  const logged = useRef(false);

  useEffect(() => {
    if (logged.current || !isAdmin || !user?.id || !mirror.farmer) return;
    logged.current = true;
    logMirrorAccess(farmerId, user.id, mirror.farmer);
  }, [isAdmin, user?.id, mirror.farmer, farmerId]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/(tabs)/home" />;

  const stats = {
    animals: mirror.animals.length,
    complete: mirror.animals.filter((a) => a.lifecycleStatus === 'complete').length,
    devices: mirror.devices.length,
    online: mirror.devices.filter((d) => d.status === 'online').length,
    paired: mirror.devices.filter((d) => d.linkedAnimalId).length,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={mirror.farmer?.fullName ?? 'Farmer mirror'} subtitle="Support mirror mode · read-only" showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.warningTint, marginBottom: spacing.md }}>
          <Icon name="eye-outline" size={16} color={colors.warning} />
          <AppText variant="caption" color={colors.warning} style={{ flex: 1, fontWeight: '600' }}>
            You are viewing {mirror.farmer?.fullName ?? mirror.farmer?.email ?? farmerId} — every access is logged.
          </AppText>
        </View>

        {loadingMirror ? (
          <AppText variant="body" color={colors.onSurfaceVariant}>
            Loading…
          </AppText>
        ) : !mirror.farmer ? (
          <EmptyState icon="account-off-outline" title="Farmer not found" subtitle="This account may have been removed." />
        ) : (
          <>
            <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, gap: spacing.md }, shadow[1]]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <IconChip icon="account-outline" />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>
                    {mirror.farmer.fullName ?? '(unnamed farmer)'}
                  </AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    {mirror.farmer.email ?? '—'}
                  </AppText>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                <Stat value={stats.animals} label="Animals" />
                <Stat value={stats.complete} label="Complete" />
                <Stat value={stats.devices} label="Devices" />
                <Stat value={stats.online} label="Online" />
                <Stat value={stats.paired} label="Paired" />
              </View>
            </View>

            <AppText variant="title" style={{ marginBottom: spacing.sm }}>
              Livestock ({mirror.animals.length})
            </AppText>
            {mirror.animals.length === 0 ? (
              <AppText variant="body" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.lg }}>
                No animals onboarded.
              </AppText>
            ) : (
              mirror.animals.map((a) => (
                <View key={a.animalId} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.divider }}>
                  {a.photoUrl ? (
                    <Image source={{ uri: a.photoUrl }} style={{ width: 32, height: 32, borderRadius: radius.sm }} />
                  ) : (
                    <View style={{ width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.divider }} />
                  )}
                  <View style={{ flex: 1 }}>
                    <AppText variant="body" style={{ fontWeight: '600' }}>
                      {a.animalName}
                    </AppText>
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      {a.animalTagId ?? a.visualTagNumber ?? 'no tag'} · {a.breed ?? '—'}
                    </AppText>
                  </View>
                  <ActionChip label={a.lifecycleStatus} variant={a.lifecycleStatus === 'complete' ? 'success' : 'warning'} />
                </View>
              ))
            )}

            <AppText variant="title" style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
              Devices ({mirror.devices.length})
            </AppText>
            {mirror.devices.length === 0 ? (
              <AppText variant="body" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.lg }}>
                No devices assigned.
              </AppText>
            ) : (
              mirror.devices.map((d) => (
                <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.divider }}>
                  <Icon name="tag-outline" size={16} color={colors.onSurfaceVariant} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="body" style={{ fontWeight: '600' }}>
                      {d.serialNumber}
                    </AppText>
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      {d.tagId} {d.linkedAnimalId ? '· linked' : '· unlinked'} · {d.batteryLevel ?? '—'}%
                    </AppText>
                  </View>
                  <ActionChip label={d.status} variant={d.status === 'online' ? 'success' : 'neutral'} />
                </View>
              ))
            )}
          </>
        )}
      </Screen>
    </View>
  );
}
