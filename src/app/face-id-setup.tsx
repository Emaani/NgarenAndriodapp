import { useCallback, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { biometricReady, enrolFaceId, faceIdState, getFaceIdProfile, FaceIdProfile } from '@/lib/identityCheck';
import { formatDateTime } from '@/lib/date';
import { useAuth } from '@/services/auth';
import { notify } from '@/lib/toast';
import { useT } from '@/i18n';
import { AppText, Button, GradientHeader, Icon, IconName, Screen } from '@/ui';

function Step({ done, icon, title, body }: { done: boolean; icon: IconName; title: string; body: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: done ? colors.success : colors.divider, marginBottom: spacing.sm }}>
      <Icon name={done ? 'check-circle' : icon} size={24} color={done ? colors.success : colors.primary} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{title}</AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant}>{body}</AppText>
      </View>
    </View>
  );
}

/**
 * Face ID set-up (Tester feedback 2026-11-07): links this phone's face unlock
 * or fingerprint to the user's profile, so approvals are tied to the person.
 * Reached after sign-up, from Settings, from the Home reminder, and whenever
 * an approval finds Face ID isn't set up.
 */
export default function FaceIdSetup() {
  const router = useRouter();
  const t = useT();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { loading, isAuthenticated } = useAuth();
  const [ready, setReady] = useState<boolean | null>(null);
  const [state, setState] = useState<'none' | 'other_device' | 'ready' | null>(null);
  const [profile, setProfile] = useState<FaceIdProfile | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    biometricReady().then(setReady);
    faceIdState().then(setState).catch(() => setState('none'));
    getFaceIdProfile().then(setProfile).catch(() => setProfile(null));
  }, []);
  // Coming back from the phone's settings re-checks what is set up.
  useFocusEffect(refresh);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const done = () => (next === 'home' ? router.replace('/(tabs)/home') : router.back());

  const openPhoneSettings = () => {
    Linking.sendIntent('android.settings.BIOMETRIC_ENROLL').catch(() =>
      Linking.sendIntent('android.settings.SECURITY_SETTINGS').catch(() => Linking.openSettings()),
    );
  };

  const link = async () => {
    setBusy(true);
    try {
      const result = await enrolFaceId({ promptMessage: t('fid.prompt'), cancelLabel: t('common.cancel') });
      if (result === 'verified') {
        notify(t('fid.linked'));
        refresh();
      } else if (result === 'not_set_up') {
        Alert.alert(t('fid.noBiometricTitle'), t('fid.noBiometricBody'));
      } else if (result === 'failed') {
        Alert.alert(t('reg.faceIdTitle'), t('fid.linkFailed'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('fid.title')} subtitle={t('fid.subtitle')} showBack={next !== 'home'} />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <AppText variant="body" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>{t('fid.intro')}</AppText>

        <Step done={!!ready} icon="face-recognition" title={t('fid.step1Title')} body={ready ? t('fid.step1Done') : t('fid.step1Body')} />
        {ready === false ? (
          <Button label={t('fid.openSettings')} icon="cog-outline" variant="outline" onPress={openPhoneSettings} style={{ marginBottom: spacing.md }} />
        ) : null}

        <Step
          done={state === 'ready'}
          icon="account-lock-outline"
          title={t('fid.step2Title')}
          body={state === 'ready' ? t('fid.step2Done') : state === 'other_device' ? t('fid.step2Other') : t('fid.step2Body')}
        />
        {state !== 'ready' ? (
          <Button label={t('fid.link')} icon="shield-check-outline" loading={busy} disabled={!ready || busy} onPress={link} style={{ marginBottom: spacing.md }} />
        ) : null}

        {profile ? (
          <View style={{ backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, gap: 2, marginBottom: spacing.md }}>
            <AppText variant="caption" color={colors.primaryDark} style={{ fontWeight: '700' }}>{t('fid.linkedDevices', { count: profile.devices.length })}</AppText>
            {profile.devices.map((d) => (
              <AppText key={d.id} variant="caption" color={colors.primaryDark}>{`${d.model} · ${formatDateTime(d.linkedAt)}`}</AppText>
            ))}
          </View>
        ) : null}

        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>{t('fid.accountability')}</AppText>
        <Button label={state === 'ready' ? t('common.continue') : t('fid.later')} variant={state === 'ready' ? 'primary' : 'outline'} onPress={done} />
      </Screen>
    </View>
  );
}
