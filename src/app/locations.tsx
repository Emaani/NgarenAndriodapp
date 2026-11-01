import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import { getLocations } from '@/data/api';
import { useResource } from '@/data/hooks';
import { useT } from '@/i18n';
import { AppText, EmptyState, GradientHeader, LocationCard, Screen } from '@/ui';

/**
 * My Locations — the farmer's registered paddocks, water points and yards.
 * Reads from the shared data layer via getLocations(): the places the herd is
 * registered at, or GET /api/ngaren/locations with a platform backend; tapping a card jumps to the live map.
 */
export default function Locations() {
  const router = useRouter();
  const t = useT();
  const { data: locations } = useResource(() => getLocations(), []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader
        title={t('profile.row.myLocations')}
        subtitle={t('loc.subtitle', { count: locations.length })}
        showBack
      />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {locations.length === 0 ? (
          <EmptyState
            icon="map-marker-off-outline"
            title={t('loc.emptyTitle')}
            subtitle={t('loc.emptySub')}
          />
        ) : (
          <>
            <AppText
              variant="caption"
              color={colors.onSurfaceVariant}
              style={{ marginBottom: spacing.sm, textTransform: 'uppercase' }}>
              {t('loc.registered')}
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
