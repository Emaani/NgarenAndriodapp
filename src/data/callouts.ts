/**
 * Vet bookings on Supabase `vet_support_requests` — the SAME table the web
 * command centre uses (useVetSupportRequests), so a booking made in either app
 * shows in both. RLS decides what each role sees: farmers their own requests,
 * vets and admins all of them.
 *
 * The table has no columns for mobile's visit details (location, mode, time
 * slot, access), so those go in `additional_notes` as labelled lines that read
 * well on web and parse back here.
 */
import { resolveAppRole } from '../lib/roles';
import { uuidToId } from '../lib/ids';
import { reportDataFailure, reportDataSuccess } from '../services/dataHealth';
import { supabase } from '../services/supabase';
import type { CalloutRequestPayload } from './api';
import { AppointmentMode, CalloutRequest, CalloutService, CalloutStatus, CalloutUrgency } from './types';
import type { ScheduleEntry } from '../lib/scheduling';

type Row = Record<string, unknown>;

const DETAIL_LABEL = {
  farmer: 'Farmer',
  services: 'Services',
  location: 'Location',
  mode: 'Mode',
  slot: 'Slot',
  access: 'Access',
  animals: 'Animals',
  vet: 'Preferred vet',
  records: 'Records',
} as const;

const MODES: AppointmentMode[] = ['onsite', 'video', 'hybrid'];

// The web app's urgency values are routine / soon / urgent.
const urgencyToRow = (urgency: CalloutUrgency) => (urgency === 'Emergency' ? 'urgent' : 'routine');
const urgencyFromRow = (urgency: unknown): CalloutUrgency => (/urgent|emergency/i.test(String(urgency)) ? 'Emergency' : 'Routine');

export function statusFromRow(status: unknown): CalloutStatus {
  switch (String(status).toLowerCase()) {
    case 'accepted':
    case 'in_progress':
      return 'accepted';
    case 'completed':
      return 'completed';
    case 'declined':
    case 'cancelled':
      return 'declined';
    default:
      return 'pending';
  }
}

/** How long ago, in the style the request lists use. */
export function requestedAgo(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60000);
  if (!Number.isFinite(minutes)) return '';
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

function detailLines(p: CalloutRequestPayload): string {
  const lines: [string, string | undefined][] = [
    [DETAIL_LABEL.farmer, p.farmerName],
    [DETAIL_LABEL.services, p.service],
    [DETAIL_LABEL.location, p.locationName],
    [DETAIL_LABEL.mode, p.mode],
    [DETAIL_LABEL.slot, p.scheduledSlot],
    [DETAIL_LABEL.access, p.accessScope],
    [DETAIL_LABEL.animals, p.accessAnimals?.join(', ')],
    [DETAIL_LABEL.vet, p.vetName],
    [DETAIL_LABEL.records, p.records?.join(', ')],
    [BOOKING_LINE.ends, p.endDate],
    [BOOKING_LINE.series, p.series],
  ];
  return lines.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join('\n');
}

export function readDetail(text: unknown, label: string): string | undefined {
  const line = String(text ?? '').split('\n').find((l) => l.startsWith(`${label}: `));
  return line?.slice(label.length + 2).trim() || undefined;
}

// Shown elsewhere on the booking, so the farmer's own note doesn't repeat them.
const REPEATED_TAGS = /\[(Purpose|Slot): [^\]]*\]\s*/g;

/** The vet's alert is a one-line summary; the booking itself keeps every tag. */
export const alertText = (notes: string) => notes.replace(/\[[A-Za-z ]+: [^\]]*\]\s*/g, '').trim();

/** The row to insert. The vet stays open unless the farmer chose a real account. */
export function calloutToRow(p: CalloutRequestPayload, requesterId: string) {
  const description = p.notes?.trim() || p.service || 'Vet visit requested';
  return {
    requester_id: requesterId,
    preferred_vet_id: p.vetUserId ?? null,
    preferred_date: p.scheduledFor ?? null,
    urgency: urgencyToRow(p.urgency),
    issue_category: p.service?.split(',')[0]?.trim() || 'Consultation',
    issue_description: description,
    animal_name: p.animal,
    animal_tag: p.animalTag ?? null,
    animal_sex: p.animalSex ?? null,
    animal_breed: p.animalBreed ?? null,
    additional_notes: detailLines(p) || null,
  };
}

/**
 * RLS doesn't let a vet read another user's profile, so the name the booking
 * carries is what makes "revealed on accept" work for vets.
 */
export function rowToCallout(row: Row, farmerName: string | undefined): CalloutRequest {
  const notes = row.additional_notes;
  const mode = readDetail(notes, DETAIL_LABEL.mode) as AppointmentMode | undefined;
  const services = readDetail(notes, DETAIL_LABEL.services) ?? (row.issue_category as string | undefined);
  return {
    id: uuidToId(String(row.id)),
    farmerName: farmerName ?? readDetail(notes, DETAIL_LABEL.farmer) ?? 'Farmer',
    animal: (row.animal_name as string) ?? '-',
    locationName: readDetail(notes, DETAIL_LABEL.location) ?? 'Farm',
    // Bookings don't carry coordinates yet; 0 means "not known" to the screens.
    distanceKm: 0,
    urgency: urgencyFromRow(row.urgency),
    notes: (row.issue_description as string | undefined)?.replace(REPEATED_TAGS, '').trim() || undefined,
    requestedAt: requestedAgo(String(row.created_at)),
    status: statusFromRow(row.status),
    scheduledFor: (row.preferred_date as string) ?? undefined,
    scheduledSlot: readDetail(notes, DETAIL_LABEL.slot),
    mode: mode && MODES.includes(mode) ? mode : undefined,
    service: services as CalloutService | undefined,
    records: readDetail(notes, DETAIL_LABEL.records)?.split(',').map((r) => r.trim()).filter(Boolean),
  };
}

/** A vet doesn't see a job another vet has taken; requesters always see theirs. */
export function takenByAnotherVet(row: Row, userId: string | undefined): boolean {
  return !!row.preferred_vet_id && row.preferred_vet_id !== userId && row.requester_id !== userId;
}

// Screens address a booking by its numeric id; the table's key is the uuid.
const uuidById = new Map<number, string>();

async function currentUserId(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id;
}

async function isVetOnly(userId: string): Promise<boolean> {
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);
  return resolveAppRole((data ?? []).map((r) => r.role as string)) === 'veterinary';
}

async function farmerNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids);
  return new Map((data ?? []).map((p) => [p.user_id as string, (p.full_name ?? p.email) as string]));
}

export async function getCalloutsFromSupabase(): Promise<CalloutRequest[]> {
  try {
    const { data, error } = await supabase
      .from('vet_support_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data) {
      reportDataFailure('callouts', error);
      return [];
    }
    reportDataSuccess();
    const userId = await currentUserId();
    const vetOnly = userId ? await isVetOnly(userId) : false;
    const changes = await getBookingChanges();
    const live = data.map((row) => applyChange(row, changes.get(String(row.id))));
    const rows = vetOnly ? live.filter((row) => !takenByAnotherVet(row, userId)) : live;
    const names = await farmerNames([...new Set(rows.map((row) => row.requester_id as string))]);
    return rows.map((row) => {
      const callout = rowToCallout(row, names.get(row.requester_id as string));
      uuidById.set(callout.id, String(row.id));
      return callout;
    });
  } catch (e) {
    reportDataFailure('callouts', e);
    return [];
  }
}

/** Throws when the booking couldn't be saved, so the farmer is told. Returns the booking's id. */
export async function submitCalloutToSupabase(payload: CalloutRequestPayload): Promise<string | undefined> {
  const requesterId = await currentUserId();
  if (!requesterId) throw new Error('Not signed in');
  const row = calloutToRow(payload, requesterId);
  const { data, error } = await supabase.from('vet_support_requests').insert(row).select('id').single();
  if (error) throw error;
  // Tells the vets in-app, as a web booking does. The booking is already saved.
  supabase.functions
    .invoke('notify-vet', {
      body: {
        request_id: data?.id,
        preferred_vet_id: row.preferred_vet_id,
        animal_name: row.animal_name,
        animal_tag: row.animal_tag,
        issue_category: row.issue_category,
        urgency: row.urgency,
        issue_description: alertText(row.issue_description),
      },
    })
    .catch(() => undefined);
  return data?.id as string | undefined;
}

/**
 * Accepting assigns the booking to this vet, so it leaves other vets' lists.
 * Throws when nothing changed: RLS rejects an update by returning no rows.
 */
export async function updateCalloutInSupabase(id: number, status: CalloutStatus): Promise<void> {
  const uuid = uuidById.get(id);
  if (!uuid) throw new Error('Unknown booking');
  const userId = await currentUserId();
  const patch = status === 'accepted' ? { status, preferred_vet_id: userId } : { status };
  const { data, error } = await supabase.from('vet_support_requests').update(patch).eq('id', uuid).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Booking not updated');
}

/* --------------------- calendar actions (Tester feedback 2026-11-07) --------------------- */

/** Lines a booking gains as it is answered or changed. */
export const BOOKING_LINE = {
  response: 'Response',
  acceptedBy: 'Vet',
  ends: 'Ends',
  series: 'Series',
} as const;

/** The notes with `label` set to `value` (removed when there is none), other lines kept. */
export function withLine(notes: unknown, label: string, value: string | undefined): string {
  const lines = String(notes ?? '').split('\n').filter((l) => l && !l.startsWith(`${label}: `));
  return (value ? [...lines, `${label}: ${value}`] : lines).join('\n');
}

/** The booking's Slot line set to `slot`, every other line kept. */
export const withSlot = (notes: unknown, slot: string): string => withLine(notes, DETAIL_LABEL.slot, slot);

const CHANGE_ACTION = 'booking_change';
const SCHEDULE_ACTION = 'vet_schedule';

export interface BookingChange {
  kind: 'cancel' | 'amend';
  date?: string;
  slot?: string;
  by: string;
  at: string;
}

/**
 * A farmer can't edit a booking row itself (only vets and admins can), so the
 * farmer's amend or cancel is shared as a change that every app applies when
 * it reads the booking.
 */
async function shareChange(uuid: string, change: BookingChange): Promise<void> {
  const actorId = await currentUserId();
  const { error } = await supabase
    .from('livestock_audit_log')
    .insert({ actor_id: actorId, action_type: CHANGE_ACTION, entity_type: 'booking', entity_id: uuid, after: change });
  if (error) throw error;
}

/** The latest shared change per booking. */
export async function getBookingChanges(): Promise<Map<string, BookingChange>> {
  try {
    const { data } = await supabase
      .from('livestock_audit_log')
      .select('entity_id, after')
      .eq('action_type', CHANGE_ACTION)
      .order('created_at', { ascending: false })
      .limit(1000);
    const out = new Map<string, BookingChange>();
    for (const r of data ?? []) {
      const c = r.after as BookingChange | null;
      if (c?.at && typeof r.entity_id === 'string' && !out.has(r.entity_id)) out.set(r.entity_id, c);
    }
    return out;
  } catch {
    return new Map();
  }
}

/** A booking row with a newer shared change applied. */
export function applyChange(row: Row, change: BookingChange | undefined): Row {
  if (!change || (row.updated_at && String(row.updated_at) > change.at)) return row;
  if (change.kind === 'cancel') return { ...row, status: 'cancelled' };
  return {
    ...row,
    preferred_date: change.date ?? row.preferred_date,
    additional_notes: change.slot ? withSlot(row.additional_notes, change.slot) : row.additional_notes,
  };
}

/** Publish the time a vet has committed to, so farmers can see the vet's availability. */
async function publishSchedule(entry: { bookingId: string; date: unknown; slot: string | undefined; state: 'busy' | 'tentative' | 'free' }) {
  const vetUserId = await currentUserId();
  if (!vetUserId || !entry.date || !entry.slot) return;
  await supabase
    .from('livestock_audit_log')
    .insert({
      actor_id: vetUserId,
      action_type: SCHEDULE_ACTION,
      entity_type: 'vet',
      entity_id: vetUserId,
      after: { bookingId: entry.bookingId, vetUserId, date: String(entry.date), slot: entry.slot, state: entry.state, at: new Date().toISOString() },
    })
    .then(() => undefined, () => undefined);
}

/** The times a vet has accepted or answered tentative, for availability. */
export async function getVetSchedule(vetUserId: string): Promise<ScheduleEntry[]> {
  try {
    const { data } = await supabase
      .from('livestock_audit_log')
      .select('after')
      .eq('action_type', SCHEDULE_ACTION)
      .eq('entity_id', vetUserId)
      .order('created_at', { ascending: false })
      .limit(500);
    return (data ?? []).map((r) => r.after as ScheduleEntry).filter((e) => !!e?.bookingId && !!e.date);
  } catch {
    return [];
  }
}

async function notify(userId: unknown, title: string, body: string) {
  if (!userId) return;
  await supabase
    .from('notifications')
    .insert({ user_id: userId, type: 'vet_request', title, body })
    .then(() => undefined, () => undefined);
}

const RESPONSE_TEXT = { accepted: 'Accepted', declined: 'Declined', tentative: 'Tentative' } as const;

/**
 * A vet answers a booking from the calendar: accept (it becomes theirs and
 * leaves other vets' lists), tentative, or decline. The answer and the vet's
 * name go on the booking, so the farmer sees who answered and how.
 */
/**
 * The booking as everyone sees it: the row with the farmer's latest shared
 * change applied. A vet writing to the booking starts from this, so the
 * farmer's amendment is kept rather than overwritten.
 */
async function currentBooking(uuid: string): Promise<Row> {
  const { data: row, error } = await supabase.from('vet_support_requests').select('*').eq('id', uuid).maybeSingle();
  if (error || !row) throw error ?? new Error('Booking not found');
  return applyChange(row, (await getBookingChanges()).get(uuid));
}

export async function setBookingStatus(uuid: string, response: 'accepted' | 'declined' | 'tentative', vetName: string): Promise<void> {
  const userId = await currentUserId();
  const row = await currentBooking(uuid);
  let notes = withLine(row.additional_notes, BOOKING_LINE.response, RESPONSE_TEXT[response]);
  notes = withLine(notes, BOOKING_LINE.acceptedBy, response === 'declined' ? undefined : vetName);
  // The farmer's date and time go into the booking itself with the answer.
  const base = { additional_notes: notes, preferred_date: row.preferred_date };
  const patch =
    response === 'accepted'
      ? { ...base, status: 'accepted', preferred_vet_id: userId }
      : response === 'declined'
        ? { ...base, status: 'declined' }
        : base;
  const { data, error } = await supabase.from('vet_support_requests').update(patch).eq('id', uuid).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Booking not updated');
  await publishSchedule({
    bookingId: uuid,
    date: row.preferred_date,
    slot: readDetail(notes, DETAIL_LABEL.slot),
    state: response === 'accepted' ? 'busy' : response === 'tentative' ? 'tentative' : 'free',
  });
  await notify(row.requester_id, `${vetName}: ${RESPONSE_TEXT[response]}`, `${row.issue_category ?? 'Visit'} on ${row.preferred_date ?? ''}`.trim());
}

/**
 * Move a booking to another day or time. A vet edits the booking directly; a
 * farmer's change is shared for the vet to see. The other side is notified.
 * Returns 'saved' when the booking itself changed, 'shared' otherwise.
 */
export async function amendBooking(uuid: string, date: string, slot: string, byName: string): Promise<'saved' | 'shared'> {
  const userId = await currentUserId();
  const { data: row, error: readErr } = await supabase
    .from('vet_support_requests')
    .select('requester_id, preferred_vet_id, additional_notes, vet_notes, issue_category, status')
    .eq('id', uuid)
    .maybeSingle();
  if (readErr || !row) throw readErr ?? new Error('Booking not found');
  const note = `Moved by ${byName} to ${date} ${slot}`;
  const byFarmer = row.requester_id === userId;
  const { data, error } = await supabase
    .from('vet_support_requests')
    .update({
      preferred_date: date,
      additional_notes: withSlot(row.additional_notes, slot),
      vet_notes: [row.vet_notes, note].filter(Boolean).join('\n'),
    })
    .eq('id', uuid)
    .select('id');
  let result: 'saved' | 'shared' = 'saved';
  if (error || !data?.length) {
    if (!byFarmer) throw error ?? new Error('Booking not updated');
    await shareChange(uuid, { kind: 'amend', date, slot, by: byName, at: new Date().toISOString() });
    result = 'shared';
  }
  if (!byFarmer) {
    const answer = readDetail(row.additional_notes, BOOKING_LINE.response);
    await publishSchedule({ bookingId: uuid, date, slot, state: row.status === 'accepted' ? 'busy' : /tentative/i.test(answer ?? '') ? 'tentative' : 'free' });
  }
  await notify(byFarmer ? row.preferred_vet_id : row.requester_id, 'Vet visit moved', `${row.issue_category ?? 'Visit'}: ${note}.`);
  return result;
}

/** The farmer cancels a booking; the vet is told. */
export async function cancelBooking(uuid: string, byName: string): Promise<void> {
  const { data: row } = await supabase.from('vet_support_requests').select('preferred_vet_id, issue_category, preferred_date').eq('id', uuid).maybeSingle();
  const { data, error } = await supabase.from('vet_support_requests').update({ status: 'cancelled' }).eq('id', uuid).select('id');
  if (error || !data?.length) await shareChange(uuid, { kind: 'cancel', by: byName, at: new Date().toISOString() });
  await notify(row?.preferred_vet_id, 'Vet visit cancelled', `${row?.issue_category ?? 'Visit'} on ${row?.preferred_date ?? ''} was cancelled by ${byName}.`);
}
