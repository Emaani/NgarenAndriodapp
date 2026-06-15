import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import { AppText, Button, GradientHeader, Input } from '@/ui';
import { useAuth } from '@/services/auth';

export default function SignUp() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const valid = name.trim() && email.trim() && password.trim();

  const onCreate = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    const { error: signUpError } = await signUp(email, password, name);
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError);
      return;
    }
    // Whether or not email confirmation is required, send them to the success
    // screen; the route guards handle gating access until a session exists.
    router.replace('/signup-success');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Create your account" subtitle="Join the Ngaren livestock platform" showBack />

      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingVertical: spacing.lg, paddingBottom: spacing.xl }}>
        <View style={{ width: 320, gap: spacing.md }}>
          <Input label="Full name" value={name} onChangeText={setName} placeholder="Patrick Etyang" autoCapitalize="words" icon="account-outline" />
          <Input label="Email address" value={email} onChangeText={setEmail} placeholder="patrickE@ngarendigital.com" keyboardType="email-address" autoCapitalize="none" icon="email-outline" />
          <Input label="Phone number" value={phone} onChangeText={setPhone} placeholder="+254 700 000 000" keyboardType="phone-pad" icon="phone-outline" />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Create a password"
            secureTextEntry={!show}
            icon={show ? 'eye-off-outline' : 'eye-outline'}
            onIconPress={() => setShow((s) => !s)}
          />

          {error && (
            <AppText variant="body" color={colors.error}>
              {error}
            </AppText>
          )}

          <Button
            label={submitting ? 'Creating account…' : 'Create account'}
            disabled={!valid || submitting}
            loading={submitting}
            onPress={onCreate}
            style={{ marginTop: spacing.sm }}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm }}>
            <AppText variant="bodyLarge" color={colors.onSurfaceVariant}>
              Already have an account?{' '}
            </AppText>
            <Pressable onPress={() => router.replace('/login')} hitSlop={6}>
              <AppText variant="bodyLarge" color={colors.accent}>
                Login
              </AppText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
