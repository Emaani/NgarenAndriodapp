import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { MessagingUnavailable, getThread, markThreadRead, myUserId, sendMessage, subscribeToMessages } from '@/data/directMessages';
import { DirectMessage, MAX_MESSAGE_LENGTH } from '@/lib/messages';
import { formatDateTime } from '@/lib/date';
import { useAuth } from '@/services/auth';
import { useT } from '@/i18n';
import { AppText, EmptyState, GradientHeader, Icon } from '@/ui';

/**
 * One conversation. A message is shown as sent once the database has stored
 * it (it then reaches the other person's Messages, bell and phone); one that
 * fails stays in the box with the reason, so nothing is lost.
 */
export default function Conversation() {
  const t = useT();
  const { userId: otherId, name } = useLocalSearchParams<{ userId: string; name?: string }>();
  const { loading, isAuthenticated, user } = useAuth();
  const [me, setMe] = useState<string | undefined>();
  const [thread, setThread] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const otherName = name || thread.find((m) => m.sender_id === otherId)?.sender_name || t('dm.someone');

  const load = useCallback(async () => {
    try {
      const [id, msgs] = await Promise.all([myUserId(), getThread(String(otherId))]);
      setMe(id);
      setThread(msgs);
      void markThreadRead(String(otherId));
    } catch (e) {
      if (e instanceof MessagingUnavailable) setUnavailable(true);
    }
  }, [otherId]);
  useFocusEffect(useCallback(() => void load(), [load]));

  // The other person's replies appear as they arrive.
  useEffect(() => {
    if (unavailable) return;
    return subscribeToMessages((m) => {
      if (m.sender_id === otherId || m.recipient_id === otherId) {
        setThread((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (m.sender_id === otherId) void markThreadRead(String(otherId));
      }
    });
  }, [otherId, unavailable]);

  useEffect(() => {
    const id = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [thread.length]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const stored = await sendMessage(String(otherId), text, user?.fullName ?? user?.email ?? 'Ngaren user');
      setThread((prev) => (prev.some((x) => x.id === stored.id) ? prev : [...prev, stored]));
      setDraft('');
    } catch (e) {
      Alert.alert(t('dm.sendFailTitle'), e instanceof MessagingUnavailable ? t('dm.unavailableSub') : t('dm.sendFailBody'));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={otherName} subtitle={t('dm.thread')} showBack />
      {unavailable ? (
        <EmptyState icon="message-alert-outline" title={t('dm.unavailableTitle')} subtitle={t('dm.unavailableSub')} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scroll} contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
            {thread.length === 0 ? (
              <AppText variant="caption" color={colors.onSurfaceVariant} style={{ textAlign: 'center', marginTop: spacing.lg }}>{t('dm.startThread', { name: otherName })}</AppText>
            ) : null}
            {thread.map((m) => {
              const mine = m.sender_id === me;
              return (
                <View key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                  <View style={{ backgroundColor: mine ? colors.primary : colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: mine ? 0 : 1, borderColor: colors.divider }}>
                    <AppText variant="body" color={mine ? '#fff' : colors.onSurface}>{m.body}</AppText>
                  </View>
                  <AppText variant="caption" color={colors.onSurfaceVariant} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', marginTop: 2, fontSize: 10 }}>
                    {formatDateTime(m.created_at)}
                    {mine ? ` · ${m.read_at ? t('dm.read') : t('dm.delivered')}` : ''}
                  </AppText>
                </View>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t('dm.placeholder')}
              placeholderTextColor={colors.onSurfaceVariant}
              multiline
              maxLength={MAX_MESSAGE_LENGTH}
              style={{ flex: 1, minHeight: 44, maxHeight: 140, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.divider, color: colors.onSurface, fontSize: 16 }}
            />
            <Pressable
              onPress={send}
              disabled={!draft.trim() || sending}
              accessibilityLabel={t('dm.send')}
              style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: draft.trim() && !sending ? colors.primary : colors.divider, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={sending ? 'progress-clock' : 'send'} size={22} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
