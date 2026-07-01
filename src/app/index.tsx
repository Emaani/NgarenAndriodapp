import { ActivityIndicator, Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { AppText } from '@/ui';
import { useAuth } from '@/services/auth';

const ngarenLogo = require('@/assets/images/ngaren-logo.png');

/**
 * Splash / auth handoff. While the persisted Supabase session is being
 * restored we show the brand splash, then hand off:
 *   - signed-in vet    -> /vet
 *   - signed-in farmer -> /(tabs)/home
 *   - signed-out        -> /onboarding
 * This keeps returning users out of the onboarding/login flow on every launch.
 */
export default function Splash() {
  const { loading, isAuthenticated, role } = useAuth();

  if (!loading) {
    if (isAuthenticated) {
      return <Redirect href={role === 'vet' ? '/vet' : '/(tabs)/home'} />;
    }
    return <Redirect href="/onboarding" />;
  }

  return (
    <LinearGradient
      colors={colors.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 110,
            height: 110,
            borderRadius: radius.full,
            backgroundColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Image
            source={ngarenLogo}
            style={{ width: 90, height: 90 }}
            resizeMode="contain"
            accessibilityLabel="Ngaren logo"
          />
        </View>
        <AppText variant="display" color="#fff">
          Ngaren
        </AppText>
        <AppText variant="bodyLarge" color="rgba(255,255,255,0.92)">
          Livestock management platform
        </AppText>
        <ActivityIndicator color="#fff" style={{ marginTop: spacing.md }} />
      </View>
      <AppText variant="caption" color="rgba(255,255,255,0.85)" style={{ marginBottom: spacing.md }}>
        Powered by Ceres Tag Technology
      </AppText>
    </LinearGradient>
  );
}
