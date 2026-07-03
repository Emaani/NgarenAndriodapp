import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import { devices as devicesFallback } from '@/data/mock';
import { getDevices, syncDevices } from '@/data/api';
import { useResource } from '@/data/hooks';
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
      setSyncMessage('Device synchronisation successful');
      reloadDevices();
    } catch {
      setSyncFailed(true);
      setSyncMessage('Device synchronisation failed — check your Ceres Tag registration');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader
        title="My Devices"
        subtitle={`${devices.length} devices · ${linked} linked`}
        showBack
      />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <Button label="Sync Ceres Tags" icon="sync" loading={syncing} onPress={onSync} style={{ marginBottom: spacing.sm }} />
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
            title="No devices yet"
            subtitle="Register an animal and link a Ceres Tag to see it here."
            actionLabel="Register Animal"
            onAction={() => router.push('/register-animal')}
          />
        ) : (
          <>
            <AppText
              variant="caption"
              color={colors.onSurfaceVariant}
              style={{ marginBottom: spacing.sm, textTransform: 'uppercase' }}>
              Ceres Tag devices
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
                label="Register a new animal"
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
