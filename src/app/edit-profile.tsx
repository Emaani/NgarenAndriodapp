import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import { useAuth } from '@/services/auth';
import { AppText, Button, GradientHeader, Input, Screen } from '@/ui';

/**
 * Edit Profile — lets the signed-in user update their display name, persisted to
 * public.profiles in the shared Supabase project (same row the web app reads).
 * Email is shown read-only: changing the auth email requires a verification
 * flow we deliberately don't trigger from here.
 */
export default function EditProfile() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [farmName, setFarmName] = useState(user?.farmName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty =
    fullName.trim() !== (user?.fullName ?? '').trim() ||
    farmName.trim() !== (user?.farmName ?? '').trim();
  const canSave = !!fullName.trim() && dirty && !saving;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const { error: saveError } = await updateProfile({ fullName, farmName });
    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Edit Profile" subtitle="Update your account details" showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <View style={{ gap: spacing.md }}>
          <Input
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name"
            autoCapitalize="words"
            icon="account-outline"
          />
          <Input
            label="Farm name"
            value={farmName}
            onChangeText={setFarmName}
            placeholder="e.g. Nakasero Farm"
            autoCapitalize="words"
            icon="barn"
            helper={
              <AppText variant="body" color={colors.onSurfaceVariant}>
                Synced to your web account.
              </AppText>
            }
          />
          <Input
            label="Email address"
            value={user?.email ?? ''}
            onChangeText={() => {}}
            editable={false}
            placeholder="—"
            icon="email-outline"
            helper={
              <AppText variant="body" color={colors.onSurfaceVariant}>
                Email is managed by your sign-in and can&apos;t be changed here.
              </AppText>
            }
          />

          {error && (
            <AppText variant="body" color={colors.error}>
              {error}
            </AppText>
          )}

          <Button
            label={saving ? 'Saving…' : 'Save changes'}
            onPress={onSave}
            loading={saving}
            disabled={!canSave}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </Screen>
    </View>
  );
}
