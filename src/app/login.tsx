import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { AppText, Button, GradientHeader, Input } from '@/ui';
import { useAuth } from '@/services/auth';
import { useT } from '@/i18n';

type LoginRole = 'farmer' | 'provider';

const ngarenLogo = require('@/assets/images/ngaren-logo.png');

export default function Login() {
  const router = useRouter();
  const t = useT();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Which kind of user is signing in. "Service Provider" follows the existing
  // vet workflow and is future-proofed for other provider types. The actual
  // role is still authoritative from Supabase; this guides routing + framing.
  const [loginRole, setLoginRole] = useState<LoginRole>('farmer');

  const onLogin = async () => {
    if (!email.trim() || !password || submitting) return;
    setSubmitting(true);
    setError(null);
    const { error: signInError, role } = await signIn(email, password);
    setSubmitting(false);
    if (signInError) {
      setError(signInError);
      return;
    }
    // Role comes from the user's Supabase roles; the guards also enforce this.
    router.replace(role === 'vet' ? '/vet' : '/(tabs)/home');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('auth.loginTitle')} subtitle={t('auth.subtitle')} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ alignItems: 'center', paddingBottom: spacing.xxl * 2 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View
          style={[
            {
              width: 84,
              height: 84,
              borderRadius: radius.full,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: -28,
            },
            shadow[1],
          ]}>
          <Image
            source={ngarenLogo}
            style={{ width: 68, height: 68 }}
            resizeMode="contain"
            accessibilityLabel="Ngaren logo"
          />
        </View>

        <View style={{ flexDirection: 'row', marginTop: spacing.mdMinus, marginBottom: spacing.md }}>
          <AppText variant="bodyLarge" color={colors.onSurfaceVariant}>
            {t('auth.noAccount')}
          </AppText>
          <Pressable onPress={() => router.push('/signup')} hitSlop={6}>
            <AppText variant="bodyLarge" color={colors.accent}>
              {t('auth.signUp')}
            </AppText>
          </Pressable>
        </View>

        {/* Login as — Farmer or Service Provider (the latter follows the vet
            workflow; future: other provider types). */}
        <View style={{ width: 320, flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.full, borderWidth: 1, borderColor: colors.divider, padding: 4, marginBottom: spacing.sm }}>
          {(['farmer', 'provider'] as LoginRole[]).map((r) => {
            const on = loginRole === r;
            return (
              <Pressable
                key={r}
                onPress={() => setLoginRole(r)}
                style={{ flex: 1, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: on ? colors.primary : 'transparent', alignItems: 'center' }}>
                <AppText variant="body" color={on ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '700' }}>
                  {t(r === 'farmer' ? 'auth.asFarmer' : 'auth.asProvider')}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ width: 320, marginBottom: spacing.md, textAlign: 'center' }}>
          {t(loginRole === 'farmer' ? 'auth.farmerHint' : 'auth.providerHint')}
        </AppText>

        <View style={{ width: 320, gap: spacing.md }}>
          <Input
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            placeholder="patrickE@ngarendigital.com"
            keyboardType="email-address"
            autoCapitalize="none"
            icon="email-outline"
          />
          <Input
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry={!show}
            icon={show ? 'eye-off-outline' : 'eye-outline'}
            onIconPress={() => setShow((s) => !s)}
            helper={
              <View style={{ flexDirection: 'row' }}>
                <AppText variant="bodyLarge" color={colors.onSurfaceVariant}>
                  {t('auth.forgot')}
                </AppText>
                <AppText variant="bodyLarge" color={colors.accent}>
                  {t('auth.reset')}
                </AppText>
              </View>
            }
          />

          {error && (
            <AppText variant="body" color={colors.error}>
              {error}
            </AppText>
          )}

          <Button
            label={submitting ? t('auth.signingIn') : t('auth.login')}
            onPress={onLogin}
            loading={submitting}
            disabled={!email.trim() || !password || submitting}
            style={{ marginTop: spacing.sm }}
          />

          {/* Social sign-in removed — accounts are provisioned by the Ngaren
              admin, so users sign in with their issued credentials only. */}
          <AppText variant="caption" color={colors.onSurfaceVariant} style={{ textAlign: 'center', marginTop: spacing.md }}>
            {t('auth.adminOnboarded')}
          </AppText>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
