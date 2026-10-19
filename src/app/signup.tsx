import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { addKycSubmission } from '@/data/localKyc';
import { colors, spacing } from '@/theme';
import { AppText, Button, GradientHeader, Input, PhotoField } from '@/ui';
import { useAuth } from '@/services/auth';
import { useT } from '@/i18n';

export default function SignUp() {
  const router = useRouter();
  const t = useT();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Farmer identification (Oct 2026 spec 1.0): scan ID + capture a photo.
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);

  const valid = name.trim() && email.trim() && password.trim();

  const onCreate = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    const { error: signUpError } = await signUp(email, password, name);
    if (signUpError) {
      setSubmitting(false);
      setError(signUpError);
      return;
    }
    // Submit KYC for Ngaren review (maker-checker, section B): captures the ID
    // document + facial ID; Admin Support approves it.
    await addKycSubmission({ name: name.trim(), email: email.trim(), phone: phone.trim(), idPhoto, selfie });
    setSubmitting(false);
    // Whether or not email confirmation is required, send them to the success
    // screen; the route guards handle gating access until a session exists.
    router.replace('/signup-success');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('signup.title')} subtitle={t('signup.subtitle')} showBack />

      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingVertical: spacing.lg, paddingBottom: spacing.xl }}>
        <View style={{ width: 320, gap: spacing.md }}>
          <Input label={t('signup.fullName')} value={name} onChangeText={setName} placeholder="Patrick Etyang" autoCapitalize="words" icon="account-outline" />
          <Input label={t('auth.email')} value={email} onChangeText={setEmail} placeholder="patrickE@ngarendigital.com" keyboardType="email-address" autoCapitalize="none" icon="email-outline" />
          <Input label={t('signup.phone')} value={phone} onChangeText={setPhone} placeholder="+254 700 000 000" keyboardType="phone-pad" icon="phone-outline" />
          <Input
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            placeholder={t('signup.passwordPlaceholder')}
            secureTextEntry={!show}
            icon={show ? 'eye-off-outline' : 'eye-outline'}
            onIconPress={() => setShow((s) => !s)}
          />

          {/* Farmer identification — scan ID + photo (spec 1.0). */}
          <AppText variant="bodyLarge" style={{ fontWeight: '600', marginTop: spacing.xs }}>
            {t('signup.identity')}
          </AppText>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {t('signup.identitySub')}
          </AppText>
          <PhotoField label={t('signup.scanId')} value={idPhoto} onChange={setIdPhoto} />
          <PhotoField label={t('signup.yourPhoto')} value={selfie} onChange={setSelfie} liveOnly />

          {error && (
            <AppText variant="body" color={colors.error}>
              {error}
            </AppText>
          )}

          <Button
            label={submitting ? t('signup.creating') : t('signup.create')}
            disabled={!valid || submitting}
            loading={submitting}
            onPress={onCreate}
            style={{ marginTop: spacing.sm }}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm }}>
            <AppText variant="bodyLarge" color={colors.onSurfaceVariant}>
              {t('signup.haveAccount')}
            </AppText>
            <Pressable onPress={() => router.replace('/login')} hitSlop={6}>
              <AppText variant="bodyLarge" color={colors.accent}>
                {t('signup.login')}
              </AppText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
