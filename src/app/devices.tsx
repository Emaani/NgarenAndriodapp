import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import { devices as devicesFallback } from '@/data/mock';
import { getDevices, syncDevices } from '@/data/api';
import { useResource } from '@/data/hooks';
import { useT } from '@/i18n';
import { AppText, Button, EmptyState, GradientHeader, DeviceCard, Screen } from '@/ui';

/**
 * My Devices — the Ceres Tag devices on the account. Reads from the shared data
 * layer via getDevices(): mock offline, GET /api/ngaren/devices when the backend
 * env vars are set. Tapping a linked device opens the animal it's attached to.
 *
 * "Sync Ceres Tags" mirrors the web app's device-sync button (GET
 * /api/sync/devices). Note: the web app only shows that action when the
 * signed-in user's OIDC profile has `isRegisteredWithCeres`, a flag set by the
 * identity gateway that isn't available over Supabase auth — so unlike the web
 * app, this button can't yet be conditionally hidden for accounts that haven't
 * completed Ceres registration. A farmer tapping it before completing that
 * registration will simply see the sync fail or return nothing new.
 */
export default function Devices() {
  const router = useRouter();
  const t = useT();
  const { data: devices, reload: reloadDevices } = useResource(() => getDevices(), devicesFallback);
  const linked = devices.filter((d) => d.linkedAnimalId !== null || d.linkedAnimalTag !== null).length;
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncFailed, setSyncFailed] = useState(false);

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader
        title={t('profile.row.myDevices')}
        subtitle={t('dev.subtitle', { count: devices.length, linked })}
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
        {devices.length === 0 ? (
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
              {t('dev.ceresDevices')}
            </AppText>
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onPress={() =>
                  device.linkedAnimalId
                    ? router.push(`/animals/${device.linkedAnimalId}`)
                    : router.push('/register-animal')
                }
                onMenu={() =>
                  device.linkedAnimalId
                    ? router.push(`/animals/${device.linkedAnimalId}`)
                    : router.push('/register-animal')
                }
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
