import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { devices as devicesFallback, isTagActive } from '@/data/mock';
import { getDevices, syncDevices } from '@/data/api';
import { useResource } from '@/data/hooks';
import { useT } from '@/i18n';
import { AppText, Button, EmptyState, GradientHeader, DeviceCard, Screen } from '@/ui';

type TagFilter = 'all' | 'active' | 'inactive';

/**
 * My Devices / Tags — the Ceres Tag devices on the account. Reads from the
 * shared data layer via getDevices(): mock offline, GET /api/ngaren/devices when
 * the backend env vars are set. Supports a ?filter=active|inactive deep link so
 * the dashboard's Active/Inactive tag tiles drill straight into the right list;
 * tapping a tag opens its full detail.
 */
export default function Devices() {
  const router = useRouter();
  const t = useT();
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>();
  const initialFilter: TagFilter = filterParam === 'active' || filterParam === 'inactive' ? filterParam : 'all';
  const [filter, setFilter] = useState<TagFilter>(initialFilter);

  const { data: devices, reload: reloadDevices } = useResource(() => getDevices(), devicesFallback);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncFailed, setSyncFailed] = useState(false);

  const activeCount = useMemo(() => devices.filter(isTagActive).length, [devices]);
  const visible = useMemo(() => {
    if (filter === 'active') return devices.filter(isTagActive);
    if (filter === 'inactive') return devices.filter((d) => !isTagActive(d));
    return devices;
  }, [devices, filter]);

  const onSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      await syncDevices();
      setSyncFailed(false);
      setSyncMessage(t('dev.syncOk'));
      reloadDevices();
    } catch {
      setSyncFailed(true);
      setSyncMessage(t('dev.syncFail'));
    } finally {
      setSyncing(false);
    }
  };

  const FILTERS: TagFilter[] = ['all', 'active', 'inactive'];
  const filterLabel: Record<TagFilter, string> = {
    all: t('dev.filterAll'),
    active: t('dev.filterActive'),
    inactive: t('dev.filterInactive'),
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader
        title={t('profile.row.myDevices')}
        subtitle={t('dev.subtitle', { count: devices.length, linked: activeCount })}
        showBack
      />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <Button label={t('dev.sync')} icon="sync" loading={syncing} onPress={onSync} style={{ marginBottom: spacing.sm }} />
        {syncMessage && (
          <AppText
            variant="caption"
            color={syncFailed ? colors.error : colors.success}
            style={{ marginBottom: spacing.md, textAlign: 'center' }}>
            {syncMessage}
          </AppText>
        )}

        {/* Active / inactive filter chips. */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          {FILTERS.map((f) => {
            const on = filter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.full,
                  backgroundColor: on ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: on ? colors.primary : colors.divider,
                }}>
                <AppText variant="caption" color={on ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                  {filterLabel[f]}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {visible.length === 0 ? (
          <EmptyState
            icon="tag-off-outline"
            title={t('dev.emptyTitle')}
            subtitle={t('dev.emptySub')}
            actionLabel={t('action.registerAnimal')}
            onAction={() => router.push('/register-animal')}
          />
        ) : (
          <>
            <AppText
              variant="caption"
              color={colors.onSurfaceVariant}
              style={{ marginBottom: spacing.sm, textTransform: 'uppercase' }}>
              {filter === 'active' ? t('dev.activeTags') : filter === 'inactive' ? t('dev.inactiveTags') : t('dev.ceresDevices')}
            </AppText>
            {visible.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onPress={() => router.push(`/devices/${device.id}` as never)}
                onMenu={() => router.push(`/devices/${device.id}` as never)}
              />
            ))}
            <View style={{ marginTop: spacing.sm }}>
              <Button
                label={t('common.regNewAnimal')}
                icon="plus"
                variant="outline"
                onPress={() => router.push('/register-animal')}
              />
            </View>
          </>
        )}
      </Screen>
    </View>
  );
}
