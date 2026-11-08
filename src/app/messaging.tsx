import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { MessagingUnavailable, getContacts, getMyMessages, myUserId, subscribeToMessages } from '@/data/directMessages';
import { Contact, ConversationSummary, conversations, roleOf } from '@/lib/messages';
import { formatDateTime } from '@/lib/date';
import { useAuth } from '@/services/auth';
import { useT } from '@/i18n';
import { AppText, BottomSheet, Button, EmptyState, GradientHeader, Icon, Screen, SearchBar } from '@/ui';

type Who = 'all' | 'ngaren' | 'vet' | 'farmer';
const WHO: Who[] = ['all', 'ngaren', 'vet', 'farmer'];

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const text = (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
  return (
    <View style={{ width: 46, height: 46, borderRadius: radius.full, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
      <AppText style={{ color: colors.primary, fontWeight: '700' }}>{text}</AppText>
    </View>
  );
}

/**
 * Messages: direct messages between farmers, vets and Ngaren staff, delivered
 * through the shared database to the other person's app (and phone, as a
 * push). Conversations are listed newest first, with unread counts.
 * `?to=ngaren|vet|farmer` opens New message on that group.
 */
export default function Messaging() {
  const router = useRouter();
  const t = useT();
  const { to } = useLocalSearchParams<{ to?: string }>();
  const { loading, isAuthenticated } = useAuth();
  const [me, setMe] = useState<string | undefined>();
  const [list, setList] = useState<ConversationSummary[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const initialWho: Who = to === 'ngaren' || to === 'vet' || to === 'farmer' ? to : 'all';
  const [picking, setPicking] = useState(!!to);
  const [who, setWho] = useState<Who>(initialWho);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [id, msgs, people] = await Promise.all([myUserId(), getMyMessages(), getContacts()]);
      setMe(id);
      setContacts(people);
      setList(id ? conversations(msgs, id, people) : []);
      setUnavailable(false);
      setFailed(false);
    } catch (e) {
      if (e instanceof MessagingUnavailable) setUnavailable(true);
      else setFailed(true);
    } finally {
      setBusy(false);
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  // New messages arrive while the list is open.
  useEffect(() => {
    if (unavailable) return;
    return subscribeToMessages(() => void load());
  }, [unavailable, load]);

  const shownContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => (who === 'all' || roleOf(c) === who) && (!q || c.name.toLowerCase().includes(q)));
  }, [contacts, who, query]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const open = (id: string, name: string) => {
    setPicking(false);
    router.push(`/messages/${id}?name=${encodeURIComponent(name)}` as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('dm.title')} subtitle={t('dm.subtitle')} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }} refreshing={busy} onRefresh={load}>
        {unavailable ? (
          <EmptyState icon="message-alert-outline" title={t('dm.unavailableTitle')} subtitle={t('dm.unavailableSub')} />
        ) : (
          <>
            <Button label={t('dm.new')} icon="message-plus-outline" onPress={() => setPicking(true)} style={{ marginBottom: spacing.md }} />
            {failed ? <AppText variant="caption" color={colors.error} style={{ marginBottom: spacing.sm }}>{t('dm.loadFail')}</AppText> : null}
            {list.length === 0 && !busy ? (
              <EmptyState icon="message-text-outline" title={t('dm.emptyTitle')} subtitle={t('dm.emptySub')} />
            ) : (
              list.map((c) => (
                <Pressable
                  key={c.otherId}
                  onPress={() => open(c.otherId, c.name)}
                  style={({ pressed }) => [
                    { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, opacity: pressed ? 0.9 : 1 },
                    shadow[1],
                  ]}>
                  <Initials name={c.name} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                      <AppText variant="bodyLarge" style={{ fontWeight: c.unread ? '700' : '600', flex: 1 }} numberOfLines={1}>{c.name}</AppText>
                      <AppText variant="caption" color={colors.onSurfaceVariant}>{formatDateTime(c.last.created_at)}</AppText>
                    </View>
                    <AppText variant="body" color={c.unread ? colors.onSurface : colors.onSurfaceVariant} numberOfLines={1}>
                      {c.last.sender_id === me ? `${t('dm.you')}: ` : ''}{c.last.body}
                    </AppText>
                  </View>
                  {c.unread ? (
                    <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                      <AppText variant="caption" color="#fff" style={{ fontWeight: '700' }}>{c.unread}</AppText>
                    </View>
                  ) : null}
                </Pressable>
              ))
            )}
          </>
        )}
      </Screen>

      {/* Pick who to message: everyone, or Ngaren staff, vets or farmers. */}
      <BottomSheet visible={picking} onClose={() => setPicking(false)} title={t('dm.new')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }}>
          {WHO.map((w) => {
            const on = who === w;
            return (
              <Pressable
                key={w}
                onPress={() => setWho(w)}
                style={{ paddingHorizontal: spacing.mdMinus, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.divider }}>
                <AppText variant="caption" color={on ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>{t(`dm.who.${w}`)}</AppText>
              </Pressable>
            );
          })}
        </View>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t('dm.search')} />
        <View style={{ height: spacing.sm }} />
        {shownContacts.length === 0 ? (
          <AppText variant="caption" color={colors.onSurfaceVariant} style={{ paddingVertical: spacing.md }}>{t('dm.noContacts')}</AppText>
        ) : (
          shownContacts.slice(0, 60).map((c) => (
            <Pressable key={c.userId} onPress={() => open(c.userId, c.name)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
              <Initials name={c.name} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{c.name}</AppText>
                <AppText variant="caption" color={colors.onSurfaceVariant}>{t(`dm.role.${roleOf(c)}`)}</AppText>
              </View>
              <Icon name="chevron-right" size={18} color={colors.onSurfaceVariant} />
            </Pressable>
          ))
        )}
      </BottomSheet>
    </View>
  );
}
