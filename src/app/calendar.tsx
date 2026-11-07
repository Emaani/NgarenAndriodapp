import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { CalendarEvent, CalendarType, getCalendarEvents } from '@/data/clinical';
import { amendBooking, cancelBooking, setBookingStatus } from '@/data/callouts';
import { RequestState, TIME_OPTIONS, fulfilmentByVet, parseSlot, requestState, slotText } from '@/lib/scheduling';
import { getLocalEvents } from '@/data/localEvents';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { uuidToId } from '@/lib/ids';
import { formatDate } from '@/lib/date';
import { notify } from '@/lib/toast';
import { useI18n } from '@/i18n';
import { ActionChip, AppText, BottomSheet, Button, DatePickerField, Fab, Icon, PickerField } from '@/ui';

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

// How each request state reads on a chip (Tester feedback 2026-11-07).
const STATE_VARIANT: Record<RequestState, 'success' | 'warning' | 'error' | 'neutral' | 'info'> = {
  accepted: 'success',
  fulfilled: 'success',
  tentative: 'warning',
  no_response: 'neutral',
  declined: 'error',
  cancelled: 'error',
  unfulfilled: 'error',
};
const STATE_FILTERS: ('all' | RequestState)[] = ['all', 'accepted', 'tentative', 'no_response', 'declined', 'fulfilled', 'unfulfilled', 'cancelled'];
const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const fromMinutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

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
  const [amendStart, setAmendStart] = useState('09:00');
  const [amendEnd, setAmendEnd] = useState('10:00');
  const [busy, setBusy] = useState<string | null>(null);
  // Month grid, or the list of requests with their status (Tester feedback 2026-11-07).
  const [view, setView] = useState<'month' | 'requests'>('month');
  const [stateFilter, setStateFilter] = useState<'all' | RequestState>('all');
  const [groupBy, setGroupBy] = useState<'date' | 'service' | 'vet'>('date');

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

  // Every booking, with where it stands.
  const requests = useMemo(
    () =>
      events
        .filter((e) => !!e.bookingId)
        .map((e) => ({ e, state: requestState({ status: e.status ?? 'pending', response: e.response, date: e.date.slice(0, 10), cancelled: e.cancelled }, todayKey) }))
        .sort((a, b) => a.e.date.localeCompare(b.e.date)),
    [events, todayKey],
  );
  const fulfilment = useMemo(() => fulfilmentByVet(requests.map((r) => ({ vet: r.e.vetName ?? t('ae.ngarenSupport'), state: r.state }))), [requests, t]);

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

  const myName = user?.fullName ?? user?.email ?? '';
  const respond = async (e: CalendarEvent, response: 'accepted' | 'declined' | 'tentative') => {
    if (!e.bookingId) return;
    setBusy(e.id);
    try {
      await setBookingStatus(e.bookingId, response, myName || 'Vet');
      notify(t(`cal.answered.${response}`));
      reload();
    } catch {
      Alert.alert(t('cal.actionFailTitle'), t('cal.actionFailBody'));
    } finally {
      setBusy(null);
    }
  };

  const startAmend = (e: CalendarEvent) => {
    const s = parseSlot(e.slot);
    setAmending(e);
    setAmendDate(e.date.slice(0, 10));
    setAmendStart(s ? fromMinutes(s.start) : '09:00');
    setAmendEnd(s ? fromMinutes(s.end) : '10:00');
  };

  const cancel = (e: CalendarEvent) => {
    if (!e.bookingId) return;
    Alert.alert(t('cal.cancelTitle'), t('cal.cancelBody', { service: e.service ?? e.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('cal.cancelConfirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy(e.id);
          try {
            await cancelBooking(e.bookingId as string, myName || 'Farmer');
            notify(t('cal.cancelled'));
            setDayOpen(null);
            reload();
          } catch {
            Alert.alert(t('cal.actionFailTitle'), t('cal.actionFailBody'));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const amendOk = !!amendDate && toMinutes(amendEnd) > toMinutes(amendStart);
  const saveAmend = async () => {
    if (!amending?.bookingId || !amendOk) return;
    setBusy(amending.id);
    try {
      const how = await amendBooking(amending.bookingId, amendDate, slotText(amendStart, amendEnd), myName || 'User');
      notify(how === 'shared' ? t('cal.amendShared') : t('cal.amended'));
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
        <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm }}>
          {(['month', 'requests'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setView(v)}
              style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: view === v ? colors.primary : colors.surface, borderWidth: 1, borderColor: view === v ? colors.primary : colors.divider }}>
              <AppText variant="caption" color={view === v ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '700' }}>
                {v === 'month' ? t('cal.viewMonth') : t('cal.viewRequests', { count: requests.length })}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      {view === 'requests' ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }} style={{ marginBottom: spacing.sm }}>
            {STATE_FILTERS.map((f) => {
              const n = f === 'all' ? requests.length : requests.filter((r) => r.state === f).length;
              const on = stateFilter === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => setStateFilter(f)}
                  style={{ paddingHorizontal: spacing.mdMinus, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.divider }}>
                  <AppText variant="caption" color={on ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                    {f === 'all' ? t('dev.filterAll') : t(`cal.state.${f}`)} ({n})
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md }}>
            <AppText variant="caption" color={colors.onSurfaceVariant}>{t('cal.groupBy')}</AppText>
            {(['date', 'service', 'vet'] as const).map((g) => (
              <Pressable key={g} onPress={() => setGroupBy(g)} style={{ paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, borderWidth: 1, borderColor: groupBy === g ? colors.primary : colors.divider }}>
                <AppText variant="caption" color={groupBy === g ? colors.primary : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>{t(`cal.group.${g}`)}</AppText>
              </Pressable>
            ))}
          </View>
          {(() => {
            const shown = requests.filter((r) => stateFilter === 'all' || r.state === stateFilter);
            if (shown.length === 0) return <AppText variant="caption" color={colors.onSurfaceVariant}>{t('cal.noRequests')}</AppText>;
            const keyOf = (r: (typeof shown)[number]) =>
              groupBy === 'service' ? r.e.service ?? '—' : groupBy === 'vet' ? r.e.vetName ?? t('ae.ngarenSupport') : formatDate(r.e.date);
            const groups = new Map<string, typeof shown>();
            shown.forEach((r) => groups.set(keyOf(r), [...(groups.get(keyOf(r)) ?? []), r]));
            return [...groups.entries()].map(([g, rows]) => (
              <View key={g} style={{ marginBottom: spacing.md }}>
                <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.xs }}>{g}</AppText>
                {rows.map(({ e, state }) => (
                  <Pressable
                    key={e.id}
                    onPress={() => setDayOpen(e.date.slice(0, 10))}
                    style={{ borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xs, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <AppText variant="body" style={{ fontWeight: '600', flex: 1 }}>{e.service ?? e.title}</AppText>
                      <ActionChip label={t(`cal.state.${state}`)} variant={STATE_VARIANT[state]} />
                    </View>
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      {[e.vetName ?? t('ae.ngarenSupport'), formatDate(e.date), e.slot].filter(Boolean).join(' · ')}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            ));
          })()}

          {/* Service fulfilment: accepted visits the vet completed with a report in the app. */}
          <AppText variant="bodyLarge" style={{ fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.xs }}>{t('cal.fulfilmentTitle')}</AppText>
          <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>{t('cal.fulfilmentNote')}</AppText>
          {fulfilment.length === 0 ? (
            <AppText variant="caption" color={colors.onSurfaceVariant}>{t('cal.fulfilmentNone')}</AppText>
          ) : (
            fulfilment.map((f) => (
              <View key={f.vet} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
                <AppText variant="body" style={{ flex: 1 }}>{f.vet}</AppText>
                <AppText variant="caption" color={colors.success}>{t('cal.fulfilledCount', { count: f.fulfilled })}</AppText>
                <AppText variant="caption" color={colors.error}>{t('cal.unfulfilledCount', { count: f.unfulfilled })}</AppText>
                <AppText variant="body" style={{ fontWeight: '700', width: 48, textAlign: 'right' }}>{f.score === null ? '—' : `${f.score}%`}</AppText>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
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
      )}

      <Fab icon="plus" onPress={() => router.push('/add-event' as never)} />

      {/* The day's activities. A vet answers a booking here: accept, decline,
          or move it to another day or time. */}
      <BottomSheet visible={!!dayOpen && !amending} onClose={() => setDayOpen(null)} title={dayOpen ? formatDate(dayOpen) : ''}>
        {dayEventsOpen.map((e) => {
          const state = e.bookingId ? requestState({ status: e.status ?? 'pending', response: e.response, date: e.date.slice(0, 10), cancelled: e.cancelled }, todayKey) : null;
          const open = state === 'no_response' || state === 'tentative' || state === 'accepted';
          // A vet answers requests to them; the farmer manages their own.
          const vetSide = canVet && !e.mine;
          return (
            <View key={e.id} style={{ borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TYPE_TINT[e.type] }} />
                <AppText variant="bodyLarge" style={{ fontWeight: '600', flex: 1 }}>{e.service ?? e.title}</AppText>
                {state ? <ActionChip label={t(`cal.state.${state}`)} variant={STATE_VARIANT[state]} /> : null}
              </View>
              {e.bookingId ? (
                <AppText variant="caption" color={colors.onSurfaceVariant}>
                  {[e.vetName ?? t('ae.ngarenSupport'), formatDate(e.date), e.slot, e.endDate ? t('cal.until', { date: formatDate(e.endDate) }) : ''].filter(Boolean).join(' · ')}
                </AppText>
              ) : e.slot || e.time ? (
                <AppText variant="caption" color={colors.onSurfaceVariant}>{e.slot ?? e.time}</AppText>
              ) : null}
              {e.bookingId && !e.mine && e.title.includes(' · ') ? <AppText variant="caption" color={colors.onSurfaceVariant}>{e.title.split(' · ')[0]}</AppText> : null}
              {e.bookingId && vetSide && open ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs }}>
                  {state !== 'accepted' ? <Button label={t('vet.accept')} icon="check" loading={busy === e.id} onPress={() => respond(e, 'accepted')} style={{ flexGrow: 1 }} /> : null}
                  {state === 'no_response' ? <Button label={t('cal.tentative')} variant="outline" onPress={() => respond(e, 'tentative')} style={{ flexGrow: 1 }} /> : null}
                  {state !== 'accepted' ? <Button label={t('vet.decline')} variant="outline" onPress={() => respond(e, 'declined')} style={{ flexGrow: 1 }} /> : null}
                  <Button label={t('cal.amend')} variant="outline" icon="calendar-edit" onPress={() => startAmend(e)} style={{ flexGrow: 1 }} />
                </View>
              ) : e.bookingId && e.mine && open ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                  <Button label={t('cal.amend')} variant="outline" icon="calendar-edit" onPress={() => startAmend(e)} style={{ flex: 1 }} />
                  <Button label={t('cal.cancelConfirm')} variant="danger" loading={busy === e.id} onPress={() => cancel(e)} style={{ flex: 1 }} />
                </View>
              ) : null}
              {e.bookingId ? (
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
        <PickerField label={t('ae.startTime')} value={amendStart} options={TIME_OPTIONS.map((v) => ({ label: v, value: v }))} onSelect={setAmendStart} />
        <PickerField label={t('ae.endTime')} value={amendEnd} options={TIME_OPTIONS.map((v) => ({ label: v, value: v }))} onSelect={setAmendEnd} />
        {!amendOk && amendDate ? <AppText variant="caption" color={colors.error} style={{ marginTop: -spacing.sm, marginBottom: spacing.sm }}>{t('ae.endBeforeStart')}</AppText> : null}
        <Button label={t('cal.amendSave')} icon="send-outline" loading={!!amending && busy === amending.id} disabled={!amendOk} onPress={saveAmend} />
      </BottomSheet>
    </View>
  );
}
