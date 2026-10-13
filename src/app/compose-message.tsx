import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { getFarmerPortfolio } from '@/data/portfolio';
import { getMessagesTo, sendMessage, MessageTarget, OutboxMessage } from '@/data/localMessages';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { sendLocalNotification } from '@/services/push';
import { notify } from '@/lib/toast';
import { formatDateTime } from '@/lib/date';
import { useT } from '@/i18n';
import { AppText, Button, GradientHeader, Icon, IconChip, Screen, SearchBar, TextField } from '@/ui';

const NGAREN_SUPPORT = 'Ngaren Support';

/**
 * In-app message portal (Oct 2026 Q&A). Compose and send an internal message to
 * Ngaren Support (?to=ngaren) or to an onboarded farmer (?to=farmer) — the
 * farmer flow first lists the farmers to pick from. Messages are stored in the
 * on-device outbox and shown as a short history. Open to every signed-in user.
 */
export default function ComposeMessage() {
  const router = useRouter();
  const t = useT();
  const { to } = useLocalSearchParams<{ to?: string }>();
  const target: MessageTarget = to === 'farmer' ? 'farmer' : 'ngaren';
  const { loading, isAuthenticated, user } = useAuth();

  const { data: farmers } = useResource(getFarmerPortfolio, []);
  const [query, setQuery] = useState('');
  const [recipientId, setRecipientId] = useState<string | null>(target === 'ngaren' ? 'ngaren' : null);
  const [recipientName, setRecipientName] = useState<string>(target === 'ngaren' ? NGAREN_SUPPORT : '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const { data: history, reload } = useResource(
    () => getMessagesTo(target, target === 'farmer' ? recipientId ?? undefined : undefined),
    [],
  );

  const filteredFarmers = useMemo(() => {
    const q = query.toLowerCase();
    return farmers.filter((f) => f.farmerName.toLowerCase().includes(q) || (f.farmName ?? '').toLowerCase().includes(q) || (f.location ?? '').toLowerCase().includes(q));
  }, [farmers, query]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const canSend = !!recipientId && subject.trim().length > 0 && body.trim().length > 0 && !sending;

  const onSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await sendMessage({
        target,
        recipientName,
        recipientId: target === 'farmer' ? recipientId ?? undefined : undefined,
        subject: subject.trim(),
        body: body.trim(),
        from: user?.fullName ?? user?.email ?? 'User',
      });
      void sendLocalNotification(t('msg.sentNotifyTitle'), t('msg.sentNotifyBody', { name: recipientName }), { type: 'MESSAGE_SENT' });
      notify(t('msg.sentToast', { name: recipientName }));
      setSubject('');
      setBody('');
      reload();
    } finally {
      setSending(false);
    }
  };

  // Farmer target with no recipient chosen yet → show the picker.
  if (target === 'farmer' && !recipientId) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title={t('msg.toFarmerTitle')} subtitle={t('msg.pickFarmer')} showBack />
        <View style={{ padding: spacing.md, paddingBottom: 0 }}>
          <SearchBar value={query} onChangeText={setQuery} placeholder={t('msg.searchFarmers')} />
        </View>
        <Screen contentStyle={{ paddingTop: spacing.md }}>
          {filteredFarmers.length === 0 ? (
            <AppText variant="body" color={colors.onSurfaceVariant}>{t('msg.noFarmers')}</AppText>
          ) : (
            filteredFarmers.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => { setRecipientId(f.id); setRecipientName(f.farmerName); reload(); }}
                style={({ pressed }) => [
                  { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.divider, opacity: pressed ? 0.9 : 1 },
                  shadow[1],
                ]}>
                <IconChip icon="account-outline" />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{f.farmerName}</AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    {[f.farmName, f.location].filter(Boolean).join(' · ')} · {t('msg.animalsCount', { count: f.animals })}
                  </AppText>
                </View>
                <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
              </Pressable>
            ))
          )}
        </Screen>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader
        title={target === 'ngaren' ? t('msg.toNgarenTitle') : recipientName}
        subtitle={target === 'ngaren' ? t('msg.toNgarenSub') : t('msg.toFarmerSub')}
        showBack
      />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {/* Recipient banner. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
          <Icon name={target === 'ngaren' ? 'shield-account-outline' : 'account-outline'} size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <AppText variant="body" style={{ fontWeight: '700' }} color={colors.primaryDark}>{recipientName}</AppText>
            <AppText variant="caption" color={colors.primaryDark}>{t('msg.internalMessage')}</AppText>
          </View>
          {target === 'farmer' ? (
            <Pressable onPress={() => { setRecipientId(null); setRecipientName(''); }} hitSlop={8}>
              <AppText variant="body" color={colors.primary} style={{ fontWeight: '600' }}>{t('msg.change')}</AppText>
            </Pressable>
          ) : null}
        </View>

        <TextField label={t('msg.subject')} required value={subject} onChangeText={setSubject} placeholder={t('msg.subjectPlaceholder')} />
        <TextField label={t('msg.message')} required value={body} onChangeText={setBody} placeholder={t('msg.messagePlaceholder')} multiline />

        <Button label={sending ? t('msg.sending') : t('msg.send')} icon="send-outline" loading={sending} disabled={!canSend} onPress={onSend} style={{ marginTop: spacing.sm }} />

        {/* Simple sent history for this recipient. */}
        {history.length > 0 ? (
          <>
            <AppText variant="title" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('msg.sentHistory')}</AppText>
            {history.map((m: OutboxMessage) => (
              <View key={m.id} style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.divider, gap: 2 }, shadow[1]]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText variant="body" style={{ fontWeight: '600', flex: 1 }}>{m.subject}</AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>{formatDateTime(m.sentAt)}</AppText>
                </View>
                <AppText variant="caption" color={colors.onSurfaceVariant}>{m.body}</AppText>
              </View>
            ))}
          </>
        ) : null}
      </Screen>
    </View>
  );
}
