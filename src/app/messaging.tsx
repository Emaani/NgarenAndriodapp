import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { Conversation, getConversations, ThreadMessage } from '@/data/ops';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { AppText, EmptyState, GradientHeader, Icon, Screen } from '@/ui';

function Avatar({ initials, online }: { initials: string; online: boolean }) {
  return (
    <View>
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: radius.full,
          backgroundColor: colors.primaryTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <AppText style={{ color: colors.primary, fontWeight: '700' }}>{initials}</AppText>
      </View>
      {online && (
        <View
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: colors.success,
            borderWidth: 2,
            borderColor: colors.surface,
          }}
        />
      )}
    </View>
  );
}

function ThreadView({ convo, onBack }: { convo: Conversation; onBack: () => void }) {
  const [thread, setThread] = useState<ThreadMessage[]>(convo.thread);
  const [draft, setDraft] = useState('');

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setThread((t) => [...t, { sender: 'You', text, time, mine: true }]);
    setDraft('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={convo.from} subtitle={convo.role} showBack onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
        {thread.map((m, i) => (
          <View
            key={i}
            style={{
              alignSelf: m.mine ? 'flex-end' : 'flex-start',
              maxWidth: '82%',
              backgroundColor: m.mine ? colors.primary : colors.surface,
              borderRadius: radius.md,
              padding: spacing.mdMinus,
              gap: 2,
            }}>
            <AppText variant="body" color={m.mine ? '#fff' : colors.onSurface}>
              {m.text}
            </AppText>
            <AppText variant="caption" color={m.mine ? 'rgba(255,255,255,0.8)' : colors.onSurfaceVariant} style={{ alignSelf: 'flex-end' }}>
              {m.time}
            </AppText>
          </View>
        ))}
      </ScrollView>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.divider,
          backgroundColor: colors.surface,
        }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message…"
          placeholderTextColor={colors.onSurfaceVariant}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.divider,
            borderRadius: radius.full,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            color: colors.onSurface,
            fontSize: 15,
          }}
        />
        <Pressable
          onPress={send}
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.full,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

export default function Messaging() {
  const { loading, isAuthenticated } = useAuth();
  const { data: conversations } = useResource(getConversations, []);
  const [selected, setSelected] = useState<Conversation | null>(null);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  if (selected) return <ThreadView convo={selected} onBack={() => setSelected(null)} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Messages" subtitle="Team & vet conversations" showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {conversations.length === 0 ? (
          <EmptyState icon="message-outline" title="No conversations" subtitle="Messages from your team and vets appear here." />
        ) : (
          conversations.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setSelected(c)}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  opacity: pressed ? 0.9 : 1,
                },
                shadow[1],
              ]}>
              <Avatar initials={c.avatar} online={c.online} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                    {c.from}
                  </AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    {c.time}
                  </AppText>
                </View>
                <AppText variant="body" color={colors.onSurfaceVariant} numberOfLines={1}>
                  {c.preview}
                </AppText>
              </View>
              {c.unread > 0 && (
                <View
                  style={{
                    minWidth: 22,
                    height: 22,
                    borderRadius: 11,
                    paddingHorizontal: 6,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <AppText variant="caption" color="#fff" style={{ fontWeight: '700' }}>
                    {c.unread}
                  </AppText>
                </View>
              )}
            </Pressable>
          ))
        )}
      </Screen>
    </View>
  );
}
