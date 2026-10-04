import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import { useAuth } from '@/services/auth';
import { useT } from '@/i18n';
import { AppText, Button, GradientHeader, Input, Screen } from '@/ui';

const MIN_LEN = 8;

/**
 * Change Password — updates the signed-in user's Supabase Auth password
 * (GoTrue identity, the same one used on the web app). We ask for the new
 * password twice to catch typos; Supabase handles the actual credential, so no
 * password is ever stored by the app. The current password isn't required here
 * because the user already holds a valid session — matching the web app's
 * ChangePasswordPage behaviour.
 */
export default function ChangePassword() {
  const router = useRouter();
  const t = useT();
  const { changePassword } = useAuth();
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const tooShort = next.length > 0 && next.length < MIN_LEN;
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSave =
    next.length >= MIN_LEN && confirm === next && !saving && !done;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const { error: saveError } = await changePassword(next);
    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    setDone(true);
    setNext('');
    setConfirm('');
    // Give the success state a beat to register, then return.
    setTimeout(() => router.back(), 1200);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('changePwd.title')} subtitle={t('changePwd.subtitle')} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <View style={{ gap: spacing.md }}>
          <Input
            label={t('changePwd.new')}
            value={next}
            onChangeText={setNext}
            placeholder={t('changePwd.newPlaceholder')}
            secureTextEntry
            autoCapitalize="none"
            icon="lock-outline"
            helper={
              <AppText variant="body" color={tooShort ? colors.error : colors.onSurfaceVariant}>
                {tooShort ? t('changePwd.helpTooShort', { min: MIN_LEN }) : t('changePwd.helpStrong')}
              </AppText>
            }
          />
          <Input
            label={t('changePwd.confirm')}
            value={confirm}
            onChangeText={setConfirm}
            placeholder={t('changePwd.confirmPlaceholder')}
            secureTextEntry
            autoCapitalize="none"
            icon="lock-check-outline"
            helper={
              mismatch ? (
                <AppText variant="body" color={colors.error}>
                  {t('changePwd.mismatch')}
                </AppText>
              ) : undefined
            }
          />

          {error && (
            <AppText variant="body" color={colors.error}>
              {error}
            </AppText>
          )}

          {done && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                backgroundColor: colors.primaryTint,
                borderRadius: spacing.sm,
                padding: spacing.md,
              }}>
              <AppText variant="body" color={colors.primary} style={{ fontWeight: '700' }}>
                {t('changePwd.successNote')}
              </AppText>
            </View>
          )}

          <Button
            label={saving ? t('changePwd.updating') : done ? t('changePwd.updated') : t('changePwd.update')}
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
