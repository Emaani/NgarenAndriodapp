import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { CalendarEvent, CalendarType, getCalendarEvents } from '@/data/clinical';
import { amendBooking, setBookingStatus } from '@/data/callouts';
import { BOOKING_SLOTS } from '@/data/scheduleSlots';
import { getLocalEvents } from '@/data/localEvents';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { uuidToId } from '@/lib/ids';
import { notify } from '@/lib/toast';
import { useI18n } from '@/i18n';
import { ActionChip, AppText, BottomSheet, Button, DatePickerField, Fab, Icon } from '@/ui';

const TYPE_TINT: Record<CalendarType, string> = {
  vet_visit: '#3D99F5',
  vaccination: '#16A34A',
  follow_up: '#F59E0B',
  tagging: '#9333EA',
  stock_take: '#F59E0B',
};

// Month/weekday names per locale. Only the 3-letter month abbreviation is shown
// (big calendar title), plus full/short weekday headers.
const MONTHS_SHORT: Record<string, string[]> = {
  en: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
  sw: ['JAN', 'FEB', 'MAC', 'APR', 'MEI', 'JUN', 'JUL', 'AGO', 'SEP', 'OKT', 'NOV', 'DES'],
};
const WEEKDAYS: Record<string, string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  sw: ['Jumapili', 'Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi'],
};
const WEEKDAYS_SHORT: Record<string, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  sw: ['J2', 'J3', 'J4', 'J5', 'Alh', 'Ij', 'J1'],
};

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
  const { locale, t } = useI18n();
  const months = MONTHS_SHORT[locale] ?? MONTHS_SHORT.en;
  const weekdays = WEEKDAYS[locale] ?? WEEKDAYS.en;
  const weekdaysShort = WEEKDAYS_SHORT[locale] ?? WEEKDAYS_SHORT.en;
  const { loading, isAuthenticated, canVet, user } = useAuth();
  const { data: events, reload } = useResource(async () => {
    const [derived, scheduled] = await Promise.all([getCalendarEvents(), getLocalEvents()]);
    return [...scheduled, ...derived];
  }, []);
  // The day the user tapped, and a booking being moved (App Review 2026-11-05).
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [amending, setAmending] = useState<CalendarEvent | null>(null);
  const [amendDate, setAmendDate] = useState('');
  const [amendSlot, setAmendSlot] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

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

  // Invite someone to a visit (Oct 2026) — discover saved/searched vets, or
  // invite Ngaren Support.
  const onInvite = () => {
    Alert.alert(t('cal.inviteTitle'), t('cal.inviteBody'), [
      { text: t('cal.inviteVet'), onPress: () => router.push('/find-vet' as never) },
      { text: t('cal.inviteNgaren'), onPress: () => router.push('/compose-message?to=ngaren' as never) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const respond = async (e: CalendarEvent, status: 'accepted' | 'declined') => {
    if (!e.bookingId) return;
    setBusy(e.id);
    try {
      await setBookingStatus(e.bookingId, status);
      notify(status === 'accepted' ? t('cal.accepted') : t('cal.declined'));
      reload();
    } catch {
      Alert.alert(t('cal.actionFailTitle'), t('cal.actionFailBody'));
    } finally {
      setBusy(null);
    }
  };

  const startAmend = (e: CalendarEvent) => {
    setAmending(e);
    setAmendDate(e.date.slice(0, 10));
    setAmendSlot(e.slot ?? '');
  };

  const saveAmend = async () => {
    if (!amending?.bookingId || !amendDate || !amendSlot) return;
    setBusy(amending.id);
    try {
      await amendBooking(amending.bookingId, amendDate, amendSlot, user?.fullName ?? user?.email ?? 'Vet');
      notify(t('cal.amended'));
      setAmending(null);
      setDayOpen(null);
      reload();
    } catch {
      Alert.alert(t('cal.actionFailTitle'), t('cal.actionFailBody'));
    } finally {
      setBusy(null);
    }
  };

  const dayEventsOpen = dayOpen ? eventsByDate.get(dayOpen) ?? [] : [];

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
            <Pressable onPress={onInvite} hitSlop={8} accessibilityLabel={t('cal.invite')}>
              <Icon name="account-plus-outline" size={24} color={colors.primary} />
            </Pressable>
            <Pressable onPress={() => shiftMonth(-1)} hitSlop={8}>
              <Icon name="chevron-left" size={24} color={colors.onSurfaceVariant} />
            </Pressable>
            <Pressable onPress={() => shiftMonth(1)} hitSlop={8}>
              <Icon name="chevron-right" size={24} color={colors.onSurfaceVariant} />
            </Pressable>
          </View>
        </View>
        <AppText style={{ fontSize: width > 700 ? 72 : 52, lineHeight: width > 700 ? 78 : 58, fontWeight: '900', letterSpacing: 2, color: colors.onSurface, marginTop: spacing.xs }}>
          {months[cursor.month]}
        </AppText>
        <AppText style={{ fontSize: width > 700 ? 30 : 24, letterSpacing: 8, color: colors.onSurface, fontWeight: '400' }}>
          {cursor.year}
        </AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginTop: spacing.xs }}>
          {monthEventCount === 1 ? t('cal.scheduledOne', { count: monthEventCount }) : t('cal.scheduled', { count: monthEventCount })}
        </AppText>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {/* Weekday header row */}
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.divider }}>
          {weekdays.map((w, i) => (
            <View key={w} style={{ flex: 1, paddingVertical: spacing.xs, alignItems: 'center' }}>
              <AppText variant="caption" color={colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                {width > 700 ? w : weekdaysShort[i]}
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
                onPress={() => {
                  if (!day) return;
                  // A day with bookings opens them; an empty day schedules something.
                  if (dayEvents.length) setDayOpen(key);
                  else router.push(`/add-event?date=${key}` as never);
                }}
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
                            {e.time ? `${e.time} ` : ''}{e.title}
                          </AppText>
                        </View>
                      ))}
                      {dayEvents.length > (width > 700 ? 3 : 2) ? (
                        <AppText variant="caption" style={{ fontSize: 9 }} color={colors.onSurfaceVariant}>
                          {t('cal.more', { count: dayEvents.length - (width > 700 ? 3 : 2) })}
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
            {t('cal.none')}
          </AppText>
        ) : null}
      </ScrollView>

      <Fab icon="plus" onPress={() => router.push('/add-event' as never)} />

      {/* The day's activities. A vet answers a booking here: accept, decline,
          or move it to another day or time. */}
      <BottomSheet visible={!!dayOpen && !amending} onClose={() => setDayOpen(null)} title={dayOpen ?? ''}>
        {dayEventsOpen.map((e) => {
          const pending = e.status === 'pending';
          return (
            <View key={e.id} style={{ borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TYPE_TINT[e.type] }} />
                <AppText variant="bodyLarge" style={{ fontWeight: '600', flex: 1 }}>{e.title}</AppText>
                {e.status ? (
                  <ActionChip
                    label={t(`cal.status.${e.status}`)}
                    variant={e.status === 'accepted' ? 'success' : e.status === 'declined' ? 'error' : e.status === 'completed' ? 'info' : 'warning'}
                  />
                ) : null}
              </View>
              {e.slot || e.time ? <AppText variant="caption" color={colors.onSurfaceVariant}>{e.slot ?? e.time}</AppText> : null}
              {e.bookingId && canVet && e.status !== 'declined' && e.status !== 'completed' ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                  {pending ? <Button label={t('vet.accept')} icon="check" loading={busy === e.id} onPress={() => respond(e, 'accepted')} style={{ flex: 1 }} /> : null}
                  {pending ? <Button label={t('vet.decline')} variant="outline" onPress={() => respond(e, 'declined')} style={{ flex: 1 }} /> : null}
                  <Button label={t('cal.amend')} variant="outline" icon="calendar-edit" onPress={() => startAmend(e)} style={{ flex: 1 }} />
                </View>
              ) : e.bookingId ? (
                <Button
                  label={t('cal.viewBooking')}
                  variant="outline"
                  onPress={() => {
                    setDayOpen(null);
                    router.push(`/vet-request/${uuidToId(e.bookingId as string)}` as never);
                  }}
                />
              ) : null}
            </View>
          );
        })}
        <Button
          label={t('cal.addActivity')}
          icon="plus"
          variant="outline"
          onPress={() => {
            const d = dayOpen;
            setDayOpen(null);
            router.push(`/add-event?date=${d}` as never);
          }}
        />
      </BottomSheet>

      <BottomSheet visible={!!amending} onClose={() => setAmending(null)} title={t('cal.amendTitle')}>
        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          {amending?.title}
        </AppText>
        <DatePickerField label={t('fv.preferredDate')} value={amendDate} onSelect={setAmendDate} />
        <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>{t('fv.timeSlot')}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md }}>
          {BOOKING_SLOTS.map((s) => {
            const on = amendSlot === s;
            return (
              <Pressable
                key={s}
                onPress={() => setAmendSlot(s)}
                style={{ paddingHorizontal: spacing.mdMinus, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.divider }}>
                <AppText variant="caption" color={on ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>{s}</AppText>
              </Pressable>
            );
          })}
        </View>
        <Button label={t('cal.amendSave')} icon="send-outline" loading={!!amending && busy === amending.id} disabled={!amendDate || !amendSlot} onPress={saveAmend} />
      </BottomSheet>
    </View>
  );
}
