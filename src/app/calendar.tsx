import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { CalendarEvent, CalendarType, getCalendarEvents } from '@/data/clinical';
import { getLocalEvents } from '@/data/localEvents';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { AppText, Fab, Icon } from '@/ui';

const TYPE_TINT: Record<CalendarType, string> = {
  vet_visit: '#3D99F5',
  vaccination: '#16A34A',
  follow_up: '#F59E0B',
  tagging: '#9333EA',
  stock_take: '#F59E0B',
};

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const isoKey = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Month-grid calendar (classic wall-calendar layout) — big month/year title,
 * weekday columns, and a 7-column grid of day cells. Scheduled activities
 * (vet visits, vaccinations, follow-ups, tagging, stock-take) render as small
 * labels inside their day. The calendar is the managed-health source of truth
 * for reminders (Sep 3 2026 standup).
 */
export default function Calendar() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { loading, isAuthenticated } = useAuth();
  const { data: events } = useResource(async () => {
    const [derived, scheduled] = await Promise.all([getCalendarEvents(), getLocalEvents()]);
    return [...scheduled, ...derived];
  }, []);

  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  const today = new Date();
  const todayKey = isoKey(today.getFullYear(), today.getMonth(), today.getDate());

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = e.date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [events]);

  // Build the grid cells (leading blanks + each day), padded to whole weeks.
  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const out: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      const m = c.month + delta;
      const year = c.year + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      return { year, month };
    });
  };

  const monthEventCount = events.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === cursor.year && d.getMonth() === cursor.month;
  }).length;

  const cellMinHeight = width > 700 ? 108 : 76;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Print-style month header with month navigation. */}
      <View style={{ paddingTop: spacing.xl, paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Icon name="chevron-left" size={28} color={colors.onSurface} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
            <Pressable onPress={() => shiftMonth(-1)} hitSlop={8}>
              <Icon name="chevron-left" size={24} color={colors.onSurfaceVariant} />
            </Pressable>
            <Pressable onPress={() => shiftMonth(1)} hitSlop={8}>
              <Icon name="chevron-right" size={24} color={colors.onSurfaceVariant} />
            </Pressable>
          </View>
        </View>
        <AppText style={{ fontSize: width > 700 ? 72 : 52, lineHeight: width > 700 ? 78 : 58, fontWeight: '900', letterSpacing: 2, color: colors.onSurface, marginTop: spacing.xs }}>
          {MONTHS[cursor.month].slice(0, 3)}
        </AppText>
        <AppText style={{ fontSize: width > 700 ? 30 : 24, letterSpacing: 8, color: colors.onSurface, fontWeight: '400' }}>
          {cursor.year}
        </AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginTop: spacing.xs }}>
          {monthEventCount} scheduled {monthEventCount === 1 ? 'activity' : 'activities'}
        </AppText>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {/* Weekday header row */}
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.divider }}>
          {WEEKDAYS.map((w, i) => (
            <View key={w} style={{ flex: 1, paddingVertical: spacing.xs, alignItems: 'center' }}>
              <AppText variant="caption" color={colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                {width > 700 ? w : WEEKDAYS_SHORT[i]}
              </AppText>
            </View>
          ))}
        </View>

        {/* Day grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((day, idx) => {
            const key = day ? isoKey(cursor.year, cursor.month, day) : `blank-${idx}`;
            const dayEvents = day ? eventsByDate.get(key) ?? [] : [];
            const isToday = key === todayKey;
            return (
              <Pressable
                key={key}
                disabled={!day}
                onPress={() => day && router.push(`/add-event?date=${key}` as never)}
                style={{
                  width: `${100 / 7}%`,
                  minHeight: cellMinHeight,
                  borderWidth: 0.5,
                  borderColor: colors.divider,
                  padding: 4,
                  backgroundColor: day ? '#fff' : '#FAFAFA',
                }}>
                {day ? (
                  <>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                      <View
                        style={{
                          minWidth: 22,
                          height: 22,
                          borderRadius: 11,
                          paddingHorizontal: 4,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isToday ? colors.primary : 'transparent',
                        }}>
                        <AppText variant="caption" style={{ fontWeight: '700' }} color={isToday ? '#fff' : colors.onSurface}>
                          {day}
                        </AppText>
                      </View>
                    </View>
                    <View style={{ gap: 2, marginTop: 2 }}>
                      {dayEvents.slice(0, width > 700 ? 3 : 2).map((e) => (
                        <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: TYPE_TINT[e.type] }} />
                          <AppText variant="caption" numberOfLines={1} style={{ flex: 1, fontSize: 9 }} color={colors.onSurface}>
                            {e.title}
                          </AppText>
                        </View>
                      ))}
                      {dayEvents.length > (width > 700 ? 3 : 2) ? (
                        <AppText variant="caption" style={{ fontSize: 9 }} color={colors.onSurfaceVariant}>
                          +{dayEvents.length - (width > 700 ? 3 : 2)} more
                        </AppText>
                      ) : null}
                    </View>
                  </>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {monthEventCount === 0 ? (
          <AppText variant="caption" color={colors.onSurfaceVariant} style={{ textAlign: 'center', marginTop: spacing.lg }}>
            No activities this month. Tap a day to schedule one.
          </AppText>
        ) : null}
      </ScrollView>

      <Fab icon="plus" onPress={() => router.push('/add-event' as never)} />
    </View>
  );
}
