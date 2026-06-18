import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import { locations } from '@/data/mock';
import { AppText, EmptyState, GradientHeader, LocationCard, Screen } from '@/ui';

/**
 * My Locations — the farmer's registered paddocks, water points and yards.
 * Reads from the shared data layer (mock until the platform-api locations
 * endpoint is wired); tapping a card jumps to the live map.
 */
export default function Locations() {
  const router = useRouter();
  const totalHa = locations.reduce((sum, l) => sum + l.sizeHa, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader
        title="My Locations"
        subtitle={`${locations.length} locations · ${totalHa} ha total`}
        showBack
      />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {locations.length === 0 ? (
          <EmptyState
            icon="map-marker-off-outline"
            title="No locations yet"
            subtitle="Locations you add will appear here."
          />
        ) : (
          <>
            <AppText
              variant="caption"
              color={colors.onSurfaceVariant}
              style={{ marginBottom: spacing.sm, textTransform: 'uppercase' }}>
              Registered locations
            </AppText>
            {locations.map((location) => (
              <LocationCard
                key={location.id}
                location={location}
                onPress={() => router.push('/(tabs)/track')}
                onMenu={() => router.push('/(tabs)/track')}
              />
            ))}
          </>
        )}
      </Screen>
    </View>
  );
}
