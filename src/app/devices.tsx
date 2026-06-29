import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import { devices as devicesFallback } from '@/data/mock';
import { getDevices } from '@/data/api';
import { useResource } from '@/data/hooks';
import { AppText, Button, EmptyState, GradientHeader, DeviceCard, Screen } from '@/ui';

/**
 * My Devices — the Ceres Tag devices on the account. Reads from the shared data
 * layer via getDevices(): mock offline, GET /api/ngaren/devices when the backend
 * env vars are set. Tapping a linked device opens the animal it's attached to.
 */
export default function Devices() {
  const router = useRouter();
  const { data: devices } = useResource(() => getDevices(), devicesFallback);
  const linked = devices.filter((d) => d.linkedAnimalId !== null || d.linkedAnimalTag !== null).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader
        title="My Devices"
        subtitle={`${devices.length} devices · ${linked} linked`}
        showBack
      />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
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
