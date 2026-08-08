import { useMemo } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { CalendarEvent, CalendarType, getCalendarEvents } from '@/data/clinical';
import { getLocalEvents } from '@/data/localEvents';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { formatDate } from '@/lib/date';
import { AppText, EmptyState, Fab, GradientHeader, Icon, IconName, Screen } from '@/ui';

const TYPE_META: Record<CalendarType, { label: string; icon: IconName; tint: string }> = {
  vet_visit: { label: 'Vet Visit', icon: 'stethoscope', tint: '#3D99F5' },
  vaccination: { label: 'Vaccination', icon: 'needle', tint: '#16A34A' },
  follow_up: { label: 'Follow-up', icon: 'calendar-clock', tint: '#F59E0B' },
  tagging: { label: 'Tagging', icon: 'tag', tint: '#9333EA' },
  stock_take: { label: 'Stock Take', icon: 'clipboard-check-outline', tint: '#F59E0B' },
};

function dayLabel(iso: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 0) return formatDate(iso);
  if (diff < 7) return `In ${diff} days`;
  return formatDate(iso);
}

export default function Calendar() {
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();
  // Derived clinical events + farmer-scheduled events, shared across roles.
  const { data: events } = useResource(async () => {
    const [derived, scheduled] = await Promise.all([getCalendarEvents(), getLocalEvents()]);
    return [...scheduled, ...derived];
  }, []);

  // Group by date, upcoming first.
  const groups = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
    const map = new Map<string, CalendarEvent[]>();
    for (const e of sorted) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return Array.from(map.entries());
  }, [events]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Calendar" subtitle={`${events.length} scheduled activities`} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {groups.length === 0 ? (
          <EmptyState icon="calendar-blank-outline" title="Nothing scheduled" subtitle="Vet visits, vaccinations and follow-ups appear here." />
        ) : (
          groups.map(([date, dayEvents]) => (
            <View key={date} style={{ marginBottom: spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
                <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>
                  {dayLabel(date)}
                </AppText>
                <AppText variant="caption" color={colors.onSurfaceVariant}>
                  {formatDate(date)}
                </AppText>
              </View>
              <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>
                {dayEvents.map((e, i) => {
                  const meta = TYPE_META[e.type];
                  return (
                    <View
                      key={e.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.md,
                        paddingVertical: spacing.md,
                        borderBottomWidth: i === dayEvents.length - 1 ? 0 : 1,
                        borderBottomColor: colors.divider,
                      }}>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: radius.md,
                          backgroundColor: meta.tint + '1A',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                        <Icon name={meta.icon} size={20} color={meta.tint} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText variant="body" style={{ fontWeight: '600' }}>
                          {e.title}
                        </AppText>
                        <AppText variant="caption" color={meta.tint} style={{ fontWeight: '600' }}>
                          {meta.label}
                        </AppText>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </Screen>
      <Fab icon="plus" onPress={() => router.push('/add-event' as never)} />
    </View>
  );
}
