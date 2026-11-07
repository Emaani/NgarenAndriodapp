/**
 * Calendar booking rules (Tester feedback 2026-11-07): start and end times,
 * repeating visits, a vet's availability at the requested time, how each
 * request is going, and whether the vet fulfilled it.
 */

/** Half-hour steps across the working day. */
export const TIME_OPTIONS = Array.from({ length: 29 }, (_, i) => {
  const mins = 6 * 60 + i * 30; // 06:00 → 20:00
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
});

export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly';
export const REPEATS: Repeat[] = ['none', 'daily', 'weekly', 'monthly'];
/** A series never books more than this many visits at once. */
export const MAX_OCCURRENCES = 12;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** The slot text the booking carries, e.g. "09:00–10:00". */
export const slotText = (start: string, end: string) => `${start}–${end}`;

/** "09:00–10:00" (or the older "08:00–10:00" grid) back into minutes. */
export function parseSlot(slot: string | undefined): { start: number; end: number } | null {
  const m = /(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})/.exec(slot ?? '');
  return m ? { start: toMin(m[1]), end: toMin(m[2]) } : null;
}

/** Why the times can't be booked, or null. */
export function timeProblem(startDate: string, startTime: string, endDate: string, endTime: string): 'missing' | 'order' | null {
  if (!startDate || !startTime || !endDate || !endTime) return 'missing';
  if (endDate < startDate || (endDate === startDate && toMin(endTime) <= toMin(startTime))) return 'order';
  return null;
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const addMonths = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  // Keep the day of the month, or the month's last day when it is shorter.
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
};

/** The start dates of a repeating visit, from `start` up to and including `until`. */
export function occurrences(start: string, repeat: Repeat, until: string | undefined): string[] {
  if (repeat === 'none' || !until || until < start) return [start];
  const out: string[] = [];
  for (let i = 0; out.length < MAX_OCCURRENCES; i += 1) {
    const d = repeat === 'daily' ? addDays(start, i) : repeat === 'weekly' ? addDays(start, i * 7) : addMonths(start, i);
    if (d > until) break;
    out.push(d);
  }
  return out;
}

/** How long a visit spans in days (0 when it ends the day it starts). */
export const spanDays = (startDate: string, endDate: string) =>
  Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000);

export const shiftDate = addDays;

/* ------------------------------ availability ------------------------------ */

export type Availability = 'available' | 'tentative' | 'busy' | 'unknown';

/** A time a vet has committed to: accepted (busy) or answered tentative. */
export interface ScheduleEntry {
  bookingId: string;
  vetUserId: string;
  date: string;
  slot: string;
  state: 'busy' | 'tentative' | 'free';
  at: string;
}

/** The latest state of each booking for the vet. */
export function currentEntries(entries: ScheduleEntry[]): ScheduleEntry[] {
  const byBooking = new Map<string, ScheduleEntry>();
  for (const e of entries) {
    const prev = byBooking.get(e.bookingId);
    if (!prev || e.at > prev.at) byBooking.set(e.bookingId, e);
  }
  return [...byBooking.values()];
}

/**
 * The vet at the requested time: busy if a visit they accepted overlaps it,
 * tentative if one they answered "tentative" does, otherwise available.
 */
export function availabilityAt(entries: ScheduleEntry[], date: string, start: string, end: string): Availability {
  const want = { start: toMin(start), end: toMin(end) };
  let result: Availability = 'available';
  for (const e of currentEntries(entries)) {
    if (e.date !== date || e.state === 'free') continue;
    const s = parseSlot(e.slot);
    if (!s || s.start >= want.end || s.end <= want.start) continue;
    if (e.state === 'busy') return 'busy';
    result = 'tentative';
  }
  return result;
}

/* ------------------------- request status & fulfilment ------------------------- */

export type RequestState = 'no_response' | 'tentative' | 'accepted' | 'declined' | 'cancelled' | 'fulfilled' | 'unfulfilled';

/**
 * Where a request stands. A visit the vet accepted is fulfilled once the vet
 * completes it with a report in the app; once its day has passed without one
 * it counts as unfulfilled.
 */
export function requestState(
  r: { status: string; response?: string; date?: string; cancelled?: boolean },
  today: string,
): RequestState {
  if (r.cancelled) return 'cancelled';
  if (r.status === 'completed') return 'fulfilled';
  if (r.status === 'declined') return 'declined';
  if (r.status === 'accepted') return r.date && r.date < today ? 'unfulfilled' : 'accepted';
  return /tentative/i.test(r.response ?? '') ? 'tentative' : 'no_response';
}

/** Fulfilled and unfulfilled visits per vet, for the fulfilment score. */
export function fulfilmentByVet(rows: { vet: string; state: RequestState }[]): { vet: string; fulfilled: number; unfulfilled: number; score: number | null }[] {
  const map = new Map<string, { fulfilled: number; unfulfilled: number }>();
  for (const r of rows) {
    if (r.state !== 'fulfilled' && r.state !== 'unfulfilled') continue;
    const v = map.get(r.vet) ?? { fulfilled: 0, unfulfilled: 0 };
    v[r.state] += 1;
    map.set(r.vet, v);
  }
  return [...map.entries()]
    .map(([vet, v]) => ({ vet, ...v, score: v.fulfilled + v.unfulfilled ? Math.round((v.fulfilled / (v.fulfilled + v.unfulfilled)) * 100) : null }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}
