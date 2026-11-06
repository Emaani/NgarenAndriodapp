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
    const rows = vetOnly ? data.filter((row) => !takenByAnotherVet(row, userId)) : data;
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

/** Accept or decline straight from the calendar, which knows the booking by its uuid. */
export async function setBookingStatus(uuid: string, status: 'accepted' | 'declined'): Promise<void> {
  const userId = await currentUserId();
  const patch = status === 'accepted' ? { status, preferred_vet_id: userId } : { status };
  const { data, error } = await supabase.from('vet_support_requests').update(patch).eq('id', uuid).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Booking not updated');
}

/** The booking's Slot line set to `slot`, every other line kept. */
export function withSlot(notes: unknown, slot: string): string {
  const lines = String(notes ?? '').split('\n').filter((l) => l && !l.startsWith(`${DETAIL_LABEL.slot}: `));
  return [...lines, `${DETAIL_LABEL.slot}: ${slot}`].join('\n');
}

/**
 * A vet proposes another day or time. The booking moves to it, the reason is
 * kept in the vet's notes, and the farmer is told (best effort).
 */
export async function amendBooking(uuid: string, date: string, slot: string, vetName: string): Promise<void> {
  const { data: row, error: readErr } = await supabase
    .from('vet_support_requests')
    .select('requester_id, additional_notes, vet_notes, issue_category')
    .eq('id', uuid)
    .maybeSingle();
  if (readErr || !row) throw readErr ?? new Error('Booking not found');
  const note = `Moved by ${vetName} to ${date} ${slot}`;
  const { data, error } = await supabase
    .from('vet_support_requests')
    .update({
      preferred_date: date,
      additional_notes: withSlot(row.additional_notes, slot),
      vet_notes: [row.vet_notes, note].filter(Boolean).join('\n'),
    })
    .eq('id', uuid)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Booking not updated');
  await supabase
    .from('notifications')
    .insert({
      user_id: row.requester_id,
      type: 'vet_request',
      title: 'Your vet visit was moved',
      body: `${row.issue_category ?? 'Visit'}: ${note}.`,
    })
    .then(() => undefined, () => undefined);
}
