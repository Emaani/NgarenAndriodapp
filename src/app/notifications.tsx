import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { getNotifications } from '@/data/api';
import { markLocalNotificationsRead } from '@/data/localNotifications';
import { markRemoteNotificationsRead } from '@/data/notifications';
import { AppNotification, NotificationCategory } from '@/data/types';
import { useT } from '@/i18n';
import { AppText, EmptyState, GradientHeader, Icon, NotificationItem, Screen } from '@/ui';

type Filter = 'all' | NotificationCategory;

const FILTERS: { key: Filter; labelKey: string }[] = [
  { key: 'all', labelKey: 'notif.all' },
  { key: 'booking', labelKey: 'notif.booking' },
  { key: 'message', labelKey: 'notif.message' },
  { key: 'device', labelKey: 'notif.device' },
  { key: 'boundary', labelKey: 'notif.boundary' },
];

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.divider,
      }}>
      <AppText variant="body" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

export default function Notifications() {
  const router = useRouter();
  const t = useT();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await getNotifications();
      setItems(list);
      // Opening the list reads them: they stay highlighted here, and the bell clears.
      void markRemoteNotificationsRead(list);
      void markLocalNotificationsRead();
    } catch {
      setItems([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((n) => n.category === filter)),
    [items, filter],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader
        title={t('profile.row.notifications')}
        subtitle={t('notif.subtitle')}
        showBack
        right={
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Pressable onPress={() => router.push('/messaging' as never)} hitSlop={8} accessibilityLabel={t('dm.title')}>
              <Icon name="message-text-outline" size={26} color="#fff" />
            </Pressable>
            <Pressable onPress={() => router.push('/notification-settings')} hitSlop={8}>
              <Icon name="cog-outline" size={26} color="#fff" />
            </Pressable>
          </View>
        }
      />
      {/* Direct messages live alongside notifications (Nov 2026). */}
      <Pressable
        onPress={() => router.push('/messaging' as never)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.md, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primaryTint }}>
        <Icon name="message-text-outline" size={20} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <AppText variant="body" style={{ fontWeight: '700' }} color={colors.primaryDark}>{t('dm.title')}</AppText>
          <AppText variant="caption" color={colors.primaryDark}>{t('dm.entrySub')}</AppText>
        </View>
        <Icon name="chevron-right" size={20} color={colors.primary} />
      </Pressable>
      <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, paddingBottom: 0 }}>
        {FILTERS.map((f) => (
          <FilterChip key={f.key} label={t(f.labelKey)} active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </View>
      <Screen refreshing={refreshing} onRefresh={load} contentStyle={{ paddingTop: spacing.md }}>
        {filtered.length === 0 ? (
          <EmptyState icon="bell-off-outline" title={t('notif.emptyTitle')} subtitle={t('notif.emptySub')} />
        ) : (
          filtered.map((n) =>
            n.category === 'message' && n.senderId ? (
              <Pressable key={n.id} onPress={() => router.push(`/messages/${n.senderId}?name=${encodeURIComponent(n.senderName ?? '')}` as never)}>
                <NotificationItem item={n} />
              </Pressable>
            ) : n.category === 'booking' ? (
              <Pressable key={n.id} onPress={() => router.push('/vet-requests' as never)}>
                <NotificationItem item={n} />
              </Pressable>
            ) : (
              <NotificationItem key={n.id} item={n} />
            ),
          )
        )}
      </Screen>
    </View>
  );
}
