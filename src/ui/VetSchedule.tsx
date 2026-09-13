import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { colors, radius, shadow, spacing } from '@/theme';
import { BOOKING_SLOTS } from '@/data/scheduleSlots';
import type { CalloutRequest, CalloutStatus } from '@/data/types';
import { AppText } from './AppText';
import { Icon } from './Icon';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const isoKey = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const STATUS_TINT: Record<CalloutStatus, string> = {
  pending: colors.warning,
  accepted: colors.success,
  completed: colors.info,
  declined: colors.error,
};
const statusLabel = (s: CalloutStatus) => s[0].toUpperCase() + s.slice(1);

/**
 * Vet calendar embedded on the dashboard (Sep 12 2026 standup) — the same
 * month-grid format the app's calendar uses, scoped to the vet's received
 * bookings, with a time-slot agenda for the selected day (e.g. 08:00–10:00).
 */
export function VetSchedule({ bookings, onOpenBooking }: { bookings: CalloutRequest[]; onOpenBooking?: (id: number) => void }) {
  const scheduled = useMemo(() => bookings.filter((b) => !!b.scheduledFor), [bookings]);

  const today = new Date();
  const todayKey = isoKey(today.getFullYear(), today.getMonth(), today.getDate());
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedKey, setSelectedKey] = useState(todayKey);

  const byDate = useMemo(() => {
    const map = new Map<string, CalloutRequest[]>();
    for (const b of scheduled) {
      const key = b.scheduledFor!.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    }
    return map;
  }, [scheduled]);

  const cells = useMemo(() => {
    const startWeekday = new Date(cursor.year, cursor.month, 1).getDay();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const out: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  const shiftMonth = (delta: number) =>
    setCursor((c) => {
      const m = c.month + delta;
      return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });

  const monthCount = scheduled.filter((b) => {
    const d = new Date(b.scheduledFor!);
    return d.getFullYear() === cursor.year && d.getMonth() === cursor.month;
  }).length;

  const selectedBookings = byDate.get(selectedKey) ?? [];
  const selectedDate = new Date(`${selectedKey}T00:00:00`);
  const selectedLabel = `${WEEKDAYS_LONG[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS_SHORT[selectedDate.getMonth()]}`;
  const bookingsForSlot = (slot: string) => selectedBookings.filter((b) => b.scheduledSlot === slot);
  // Any bookings on the selected day without a recognised slot (e.g. emergencies).
  const unslotted = selectedBookings.filter((b) => !b.scheduledSlot || !BOOKING_SLOTS.includes(b.scheduledSlot));

  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
      {/* Month header + nav */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <View>
          <AppText variant="bodyLarge" style={{ fontWeight: '800' }}>
            {MONTHS[cursor.month]} {cursor.year}
          </AppText>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {monthCount} booking{monthCount === 1 ? '' : 's'} this month
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={8}>
            <Icon name="chevron-left" size={24} color={colors.onSurfaceVariant} />
          </Pressable>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={8}>
            <Icon name="chevron-right" size={24} color={colors.onSurfaceVariant} />
          </Pressable>
        </View>
      </View>

      {/* Weekday row */}
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS_SHORT.map((w, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 2 }}>
            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ fontWeight: '700' }}>
              {w}
            </AppText>
          </View>
        ))}
      </View>

      {/* Day grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, idx) => {
          if (!day) return <View key={`b-${idx}`} style={{ width: `${100 / 7}%`, height: 44 }} />;
          const key = isoKey(cursor.year, cursor.month, day);
          const dayBookings = byDate.get(key) ?? [];
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          return (
            <Pressable
              key={key}
              onPress={() => setSelectedKey(key)}
              style={{ width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSelected ? colors.primary : isToday ? colors.primaryTint : 'transparent',
                }}>
                <AppText variant="caption" style={{ fontWeight: '700' }} color={isSelected ? '#fff' : colors.onSurface}>
                  {day}
                </AppText>
              </View>
              {/* Booking dots (up to 3). */}
              <View style={{ flexDirection: 'row', gap: 2, height: 5, marginTop: 1 }}>
                {dayBookings.slice(0, 3).map((b) => (
                  <View key={b.id} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSelected ? '#fff' : STATUS_TINT[b.status] }} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Time-slot agenda for the selected day */}
      <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm }} />
      <AppText variant="body" style={{ fontWeight: '700', marginBottom: spacing.xs }}>
        {selectedLabel}
      </AppText>
      <View style={{ gap: spacing.xs }}>
        {BOOKING_SLOTS.map((slot) => {
          const slotBookings = bookingsForSlot(slot);
          const booked = slotBookings.length > 0;
          return (
            <View key={slot} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <AppText variant="caption" color={colors.onSurfaceVariant} style={{ width: 92, fontWeight: '600' }}>
                {slot}
              </AppText>
              {booked ? (
                <View style={{ flex: 1, gap: spacing.xs }}>
                  {slotBookings.map((b) => (
                    <Pressable
                      key={b.id}
                      onPress={() => onOpenBooking?.(b.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: STATUS_TINT[b.status] + '18', borderRadius: radius.sm, borderLeftWidth: 3, borderLeftColor: STATUS_TINT[b.status], paddingVertical: spacing.xs, paddingHorizontal: spacing.sm }}>
                      <View style={{ flex: 1 }}>
                        <AppText variant="caption" style={{ fontWeight: '700' }} color={colors.onSurface}>
                          {b.animal}
                          {b.urgency === 'Emergency' ? ' · Emergency' : ''}
                        </AppText>
                        <AppText variant="caption" color={colors.onSurfaceVariant}>
                          {b.status === 'pending' ? b.locationName : b.farmerName} · {statusLabel(b.status)}
                        </AppText>
                      </View>
                      <Icon name="chevron-right" size={16} color={colors.onSurfaceVariant} />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={{ flex: 1, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.divider, borderStyle: 'dashed', paddingVertical: spacing.xs, paddingHorizontal: spacing.sm }}>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    Open
                  </AppText>
                </View>
              )}
            </View>
          );
        })}
        {unslotted.length > 0 ? (
          <View style={{ marginTop: spacing.xs, gap: spacing.xs }}>
            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ fontWeight: '700' }}>
              Unscheduled
            </AppText>
            {unslotted.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => onOpenBooking?.(b.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: STATUS_TINT[b.status] + '18', borderRadius: radius.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm }}>
                <AppText variant="caption" style={{ flex: 1, fontWeight: '700' }} color={colors.onSurface}>
                  {b.animal} · {statusLabel(b.status)}
                </AppText>
                <Icon name="chevron-right" size={16} color={colors.onSurfaceVariant} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}
