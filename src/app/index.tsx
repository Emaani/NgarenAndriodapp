import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { AppText, Icon } from '@/ui';

/**
 * Splash / auth handoff. In the backend phase this checks the OIDC token;
 * for now it brands and routes to onboarding.
 */
export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.replace('/onboarding'), 1400);
    return () => clearTimeout(t);
  }, [router]);

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
          <Icon name="cow" size={60} color={colors.primary} />
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
