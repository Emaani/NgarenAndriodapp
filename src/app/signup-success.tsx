import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { AppText, Button, Icon } from '@/ui';
import { useT } from '@/i18n';

export default function SignUpSuccess() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 120,
            height: 120,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="check-bold" size={64} color="#fff" />
        </LinearGradient>
        <AppText variant="headline" style={{ textAlign: 'center' }}>
          {t('success.title')}
        </AppText>
        <AppText variant="bodyLarge" color={colors.onSurfaceVariant} style={{ textAlign: 'center' }}>
          {t('success.body')}
        </AppText>
      </View>
      <Button
        label={t('common.continue')}
        onPress={() => router.replace('/(tabs)/home')}
        style={{ marginBottom: insets.bottom + spacing.lg }}
      />
    </View>
  );
}
