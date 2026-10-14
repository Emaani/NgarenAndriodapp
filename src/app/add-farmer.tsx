import { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { addLocalFarmer } from '@/data/localFarmers';
import { useAuth } from '@/services/auth';
import { notify } from '@/lib/toast';
import { useT } from '@/i18n';
import { AppText, Button, GradientHeader, Icon, Screen, TextField } from '@/ui';

/**
 * Add Farmer (admin) — register a farmer under the Farmer Portfolio. The record
 * starts Inactive (pending activation); the admin activates it from the
 * portfolio once validated (maker-checker parity with animal activation).
 */
export default function AddFarmer() {
  const router = useRouter();
  const t = useT();
  const { loading, isAuthenticated, isAdmin, user } = useAuth();

  const [farmerName, setFarmerName] = useState('');
  const [farmName, setFarmName] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/(tabs)/home" />;

  const canSubmit = farmerName.trim().length > 0 && location.trim().length > 0 && !saving;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await addLocalFarmer({
        farmerName: farmerName.trim(),
        farmName: farmName.trim(),
        location: location.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        addedBy: user?.fullName ?? user?.email ?? 'Admin',
      });
      notify(t('af.addedToast', { name: farmerName.trim() }));
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('af.title')} subtitle={t('af.subtitle')} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <TextField label={t('af.farmerName')} required value={farmerName} onChangeText={setFarmerName} placeholder={t('af.farmerNamePlaceholder')} />
        <TextField label={t('af.farmName')} value={farmName} onChangeText={setFarmName} placeholder={t('af.farmNamePlaceholder')} />
        <TextField label={t('af.location')} required value={location} onChangeText={setLocation} placeholder={t('af.locationPlaceholder')} />
        <TextField label={t('af.phone')} value={phone} onChangeText={setPhone} placeholder="+256…" keyboardType="phone-pad" />
        <TextField label={t('af.email')} value={email} onChangeText={setEmail} placeholder="farmer@example.com" keyboardType="email-address" />

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm, marginBottom: spacing.md }}>
          <Icon name="information-outline" size={18} color={colors.primary} />
          <AppText variant="caption" color={colors.primaryDark} style={{ flex: 1 }}>
            {t('af.activationNote')}
          </AppText>
        </View>

        <Button label={saving ? t('af.saving') : t('af.submit')} icon="account-plus-outline" loading={saving} disabled={!canSubmit} onPress={onSubmit} />
      </Screen>
    </View>
  );
}
