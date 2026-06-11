import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { AppText, Button, GradientHeader, Input } from '@/ui';

type Role = 'Farmer' | 'Vet';

export default function SignUp() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [role, setRole] = useState<Role>('Farmer');

  const valid = name.trim() && email.trim() && password.trim();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Create your account" subtitle="Join the Ngaren livestock platform" showBack />

      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingVertical: spacing.lg, paddingBottom: spacing.xl }}>
        <View style={{ width: 320, gap: spacing.md }}>
          <View style={{ gap: spacing.sm }}>
            <AppText variant="bodyLarge">I am a</AppText>
            <View style={{ flexDirection: 'row', gap: spacing.mdMinus }}>
              {(['Farmer', 'Vet'] as Role[]).map((r) => {
                const active = role === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setRole(r)}
                    style={{
                      flex: 1,
                      height: 48,
                      borderRadius: radius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: active ? colors.primaryTint : colors.surface,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.divider,
                    }}>
                    <AppText variant="bodyLarge" color={active ? colors.primary : colors.onSurfaceVariant}>
                      {r}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Input label="Full name" value={name} onChangeText={setName} placeholder="Patrick Etyang" autoCapitalize="words" icon="account-outline" />
          <Input label="Email address" value={email} onChangeText={setEmail} placeholder="patrickE@ngarendigital.com" keyboardType="email-address" icon="email-outline" />
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

          <Button label="Create account" disabled={!valid} onPress={() => router.replace('/signup-success')} style={{ marginTop: spacing.sm }} />

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
