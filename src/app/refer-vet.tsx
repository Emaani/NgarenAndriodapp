import { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { addSupportRequest } from '@/data/supportRequests';
import { addLocalNotification } from '@/data/localNotifications';
import { useAuth } from '@/services/auth';
import { sendLocalNotification } from '@/services/push';
import { notify } from '@/lib/toast';
import { useT } from '@/i18n';
import { AppText, Button, GradientHeader, Icon, Screen, TextField } from '@/ui';

/**
 * Refer a vet (spec 7) — the farmer captures a vet's name and contact and sends
 * it to Ngaren Service Support as a potential enlistment lead. Logged as a
 * support request and notifies the Ngaren Admin in-app.
 */
export default function ReferVet() {
  const router = useRouter();
  const t = useT();
  const { loading, isAuthenticated, user } = useAuth();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const canSubmit = name.trim().length > 0 && contact.trim().length > 0 && !saving;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const by = user?.fullName ?? user?.email ?? 'Farmer';
      const detail = `Vet referral: ${name.trim()} · ${contact.trim()}${location.trim() ? ` · ${location.trim()}` : ''}${notes.trim() ? ` · ${notes.trim()}` : ''} (referred by ${by})`;
      await addSupportRequest({ animalsCount: 0, notes: detail, requestedBy: by });
      await addLocalNotification({ title: 'Vet referral', message: detail });
      void sendLocalNotification(t('refv.notifyTitle'), t('refv.notifyBody', { name: name.trim() }), { type: 'VET_REFERRAL' });
      notify(t('refv.sentToast'));
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('refv.title')} subtitle={t('refv.subtitle')} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
          <Icon name="information-outline" size={18} color={colors.primary} />
          <AppText variant="caption" color={colors.primaryDark} style={{ flex: 1 }}>{t('refv.intro')}</AppText>
        </View>
        <TextField label={t('refv.name')} required value={name} onChangeText={setName} placeholder={t('refv.namePlaceholder')} />
        <TextField label={t('refv.contact')} required value={contact} onChangeText={setContact} placeholder={t('refv.contactPlaceholder')} />
        <TextField label={t('refv.location')} value={location} onChangeText={setLocation} placeholder={t('refv.locationPlaceholder')} />
        <TextField label={t('ad.notes')} value={notes} onChangeText={setNotes} placeholder={t('refv.notesPlaceholder')} multiline />
        <Button label={saving ? t('refv.sending') : t('refv.submit')} icon="send-outline" loading={saving} disabled={!canSubmit} onPress={onSubmit} style={{ marginTop: spacing.sm }} />
      </Screen>
    </View>
  );
}
