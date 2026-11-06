/**
 * Records handed to Ngaren support or a vet, and the vet's proposed changes,
 * shared through Supabase `livestock_audit_log` (see lib/recordAssignments).
 */
import { isSupabaseConfigured } from '../config';
import { supabase } from '../services/supabase';
import { uploadPhoto } from '../lib/imageUpload';
import {
  AMENDMENT_ACTION,
  AMENDMENT_DECISION_ACTION,
  ASSIGNMENT_ACTION,
  AssignmentStatus,
  RecordAssignment,
  SharedAmendment,
  amendmentToAuditRow,
  assignmentFromAuditRow,
  assignmentToAuditRow,
  decisionToAuditRow,
  latestAssignments,
  lineagePatch,
  nextAssignment,
  pendingAmendments,
  snapshotOf,
} from '../lib/recordAssignments';
import { RegistrationDraft, saveDraft } from './localRegistrationDrafts';
import { Animal, AppointmentMode } from './types';

const LIMIT = 1000;

async function actorId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

/** The current state of every assigned record, newest first. */
export async function getAssignments(): Promise<RecordAssignment[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from('livestock_audit_log')
      .select('entity_id, after')
      .eq('action_type', ASSIGNMENT_ACTION)
      .order('created_at', { ascending: false })
      .limit(LIMIT);
    if (error || !data) return [];
    return latestAssignments(data.map(assignmentFromAuditRow).filter((a): a is RecordAssignment => !!a));
  } catch {
    return [];
  }
}

export async function getAssignment(aan: string): Promise<RecordAssignment | undefined> {
  return (await getAssignments()).find((a) => a.aan === aan);
}

export async function publishAssignment(a: RecordAssignment): Promise<void> {
  const { error } = await supabase.from('livestock_audit_log').insert(assignmentToAuditRow(a, await actorId()));
  if (error) throw new Error(error.message);
}

/** Move an assignment on. Throws if it couldn't be shared. */
export async function updateAssignment(
  prev: RecordAssignment,
  status: AssignmentStatus,
  by: { id: string; name?: string },
  extra: Partial<RecordAssignment> = {},
): Promise<RecordAssignment> {
  const next = nextAssignment(prev, status, by, extra);
  await publishAssignment(next);
  return next;
}

/**
 * The draft with its photos uploaded, so the vet's phone can show them. A
 * photo that fails to upload is left out rather than sent as a path that only
 * exists on this phone.
 */
export async function shareableDraft(d: RegistrationDraft, userId: string): Promise<RegistrationDraft> {
  const up = async (uri: string | null | undefined, name: string) =>
    uri ? uploadPhoto(uri, `${userId}/${d.aan}/${name}-${Date.now()}.jpg`) : null;
  const photos = await Promise.all((d.photos ?? []).map((p, i) => up(p, `draft-${i}`)));
  const devices = await Promise.all(
    (d.devices ?? []).map(async (dev, i) => ({ ...dev, photo: await up(dev.photo, `device-${i}`) })),
  );
  return { ...d, photos, devices };
}

/**
 * Hand records to the vet booked for them: incomplete registrations to finish,
 * existing animals to review and maintain. Each is shared on its own, so one
 * that fails doesn't stop the rest.
 */
export async function assignRecordsToVet(input: {
  drafts: RegistrationDraft[];
  animals: Animal[];
  farmer: { id: string; name: string };
  booking: { id?: string; service: string; mode?: AppointmentMode; date?: string; slot?: string; meetingLink?: string };
}): Promise<{ shared: string[]; failed: string[] }> {
  const shared: string[] = [];
  const failed: string[] = [];
  const at = new Date().toISOString();
  const base = {
    status: 'submitted_to_vet' as const,
    farmerId: input.farmer.id,
    farmerName: input.farmer.name,
    service: input.booking.service,
    mode: input.booking.mode,
    date: input.booking.date,
    slot: input.booking.slot,
    meetingLink: input.booking.meetingLink,
    bookingId: input.booking.id,
    updatedBy: input.farmer.id,
    updatedByName: input.farmer.name,
    at,
  };
  for (const d of input.drafts) {
    try {
      await publishAssignment({ ...base, aan: d.aan, kind: 'registration', draft: await shareableDraft(d, input.farmer.id) });
      await saveDraft({ ...d, assignedToVet: at });
      shared.push(d.aan);
    } catch {
      failed.push(d.aan);
    }
  }
  for (const a of input.animals) {
    const aan = a.ngarenCode ?? a.tag;
    try {
      await publishAssignment({ ...base, aan, kind: 'maintenance', animal: snapshotOf(a) });
      shared.push(aan);
    } catch {
      failed.push(aan);
    }
  }
  return { shared, failed };
}

/* ------------------------------ amendments ------------------------------ */

export async function shareAmendment(a: SharedAmendment): Promise<void> {
  const { error } = await supabase.from('livestock_audit_log').insert(amendmentToAuditRow(a, await actorId()));
  if (error) throw new Error(error.message);
}

/** Vet changes still waiting for the farmer. */
export async function getSharedAmendments(): Promise<SharedAmendment[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const [{ data: rows }, { data: decisions }] = await Promise.all([
      supabase.from('livestock_audit_log').select('after').eq('action_type', AMENDMENT_ACTION).order('created_at', { ascending: false }).limit(LIMIT),
      supabase.from('livestock_audit_log').select('after').eq('action_type', AMENDMENT_DECISION_ACTION).limit(LIMIT),
    ]);
    const all = (rows ?? []).map((r) => r.after as SharedAmendment).filter((a) => !!a?.id && !!a.animalKey);
    return pendingAmendments(all, (decisions ?? []).map((r) => (r.after ?? {}) as { id?: unknown; status?: unknown }));
  } catch {
    return [];
  }
}

/**
 * Record the farmer's decision and, on approval, apply the change to the
 * shared record so the web and every phone see it.
 */
export async function decideSharedAmendment(a: SharedAmendment, status: 'approved' | 'rejected'): Promise<void> {
  const id = await actorId();
  if (status === 'approved') {
    const patch = lineagePatch(a.patch as Partial<Animal>);
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from('animal_lineage').update(patch).eq('animal_id', a.animalKey);
      if (error) throw new Error(error.message);
    }
  }
  const { error } = await supabase.from('livestock_audit_log').insert(decisionToAuditRow(a.id, status, a.animalKey, id));
  if (error) throw new Error(error.message);
}
