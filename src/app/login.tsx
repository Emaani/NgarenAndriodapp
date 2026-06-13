import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { AppText, Button, GradientHeader, Icon, IconName, Input } from '@/ui';
import { Role, useAuth } from '@/services/auth';

const ROLES: { key: Role; label: string; icon: IconName }[] = [
  { key: 'farmer', label: 'Farmer', icon: 'cow' },
  { key: 'vet', label: 'Vet', icon: 'stethoscope' },
];

function SocialButton({ icon, color }: { icon: IconName; color: string }) {
  return (
    <View
      style={[
        {
          width: 100,
          height: 60,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        },
        shadow[1],
      ]}>
      <Icon name={icon} size={32} color={color} />
    </View>
  );
}

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [role, setRole] = useState<Role>('farmer');

  const onLogin = () => {
    signIn(role);
    router.replace(role === 'vet' ? '/vet' : '/(tabs)/home');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Login to Ngaren" subtitle="Livestock management platform" />

      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: spacing.xl }}>
        <View
          style={[
            {
              width: 78,
              height: 78,
              borderRadius: radius.full,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: -28,
              borderWidth: 2,
              borderColor: colors.primary,
            },
            shadow[1],
          ]}>
          <Icon name="cow" size={44} color={colors.primary} />
        </View>

        <View style={{ flexDirection: 'row', marginTop: spacing.mdMinus, marginBottom: spacing.lg }}>
          <AppText variant="bodyLarge" color={colors.onSurfaceVariant}>
            Don't have an account?{' '}
          </AppText>
          <Pressable onPress={() => router.push('/signup')} hitSlop={6}>
            <AppText variant="bodyLarge" color={colors.accent}>
              Sign up
            </AppText>
          </Pressable>
        </View>

        <View style={{ width: 320, gap: spacing.md }}>
          <View style={{ gap: spacing.sm }}>
            <AppText variant="body" color={colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
              I am signing in as
            </AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {ROLES.map((r) => {
                const active = role === r.key;
                return (
                  <Pressable
                    key={r.key}
                    onPress={() => setRole(r.key)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: spacing.sm,
                      paddingVertical: spacing.mdMinus,
                      borderRadius: radius.md,
                      backgroundColor: active ? colors.primary : colors.surface,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.divider,
                    }}>
                    <Icon name={r.icon} size={20} color={active ? '#fff' : colors.onSurfaceVariant} />
                    <AppText variant="bodyLarge" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                      {r.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Input
            label="Email address"
            value={email}
            onChangeText={setEmail}
            placeholder="patrickE@ngarendigital.com"
            keyboardType="email-address"
            icon="email-outline"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry={!show}
            icon={show ? 'eye-off-outline' : 'eye-outline'}
            onIconPress={() => setShow((s) => !s)}
            helper={
              <View style={{ flexDirection: 'row' }}>
                <AppText variant="bodyLarge" color={colors.onSurfaceVariant}>
                  Forgot your password?{' '}
                </AppText>
                <AppText variant="bodyLarge" color={colors.accent}>
                  Reset
                </AppText>
              </View>
            }
          />

          <Button label="Login" onPress={onLogin} style={{ marginTop: spacing.sm }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.md }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
            <AppText variant="body" color={colors.onSurfaceVariant}>
              or login with
            </AppText>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.mdMinus }}>
            <SocialButton icon="google" color="#EA4335" />
            <SocialButton icon="apple" color="#000" />
            <SocialButton icon="facebook" color="#1877F2" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
