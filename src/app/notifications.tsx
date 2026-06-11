import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { getNotifications } from '@/data/api';
import { AppNotification, NotificationCategory } from '@/data/types';
import { AppText, EmptyState, GradientHeader, Icon, NotificationItem, Screen } from '@/ui';

type Filter = 'all' | NotificationCategory;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'device', label: 'Device' },
  { key: 'boundary', label: 'Boundary' },
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
  const [items, setItems] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setItems(await getNotifications());
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
        title="Notifications"
        subtitle="Alerts from your herd & devices"
        showBack
        right={
          <Pressable onPress={() => router.push('/notification-settings')} hitSlop={8}>
            <Icon name="cog-outline" size={26} color="#fff" />
          </Pressable>
        }
      />
      <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, paddingBottom: 0 }}>
        {FILTERS.map((f) => (
          <FilterChip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </View>
      <Screen refreshing={refreshing} onRefresh={load} contentStyle={{ paddingTop: spacing.md }}>
        {filtered.length === 0 ? (
          <EmptyState icon="bell-off-outline" title="No notifications" subtitle="You're all caught up." />
        ) : (
          filtered.map((n) => <NotificationItem key={n.id} item={n} />)
        )}
      </Screen>
    </View>
  );
}
