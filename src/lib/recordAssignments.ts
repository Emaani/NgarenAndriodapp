/**
 * Records a farmer hands to Ngaren support or a vet (App Review 2026-11-05):
 * an incomplete registration to finish, or existing records to review and
 * maintain.
 *
 * Drafts and amendments used to stay on the phone that made them, so a vet on
 * another device never saw the farmer's record. They now travel through
 * Supabase `livestock_audit_log`, which farmers, vets and admins can all read
 * and write, the same way stock-take confirmations do. The latest row per AAN
 * is the assignment's current state.
 */
import type { RegistrationDraft } from '@/data/localRegistrationDrafts';
import type { AnimalAmendment } from '@/data/localAmendments';
import type { Animal, AppointmentMode } from '@/data/types';

export const ASSIGNMENT_ACTION = 'record_assignment';
export const AMENDMENT_ACTION = 'record_amendment';
export const AMENDMENT_DECISION_ACTION = 'record_amendment_decision';

export type AssignmentKind = 'registration' | 'maintenance';
export type AssignmentStatus = 'submitted_to_vet' | 'vet_in_progress' | 'submitted_for_approval' | 'approved' | 'cancelled';

/** What the vet needs of an existing animal to maintain its record. */
export interface AnimalSnapshot {
  name?: string;
  tag?: string;
  breed?: { key: string; name: string };
  color?: string;
  sex?: Animal['sex'];
  dateOfBirth?: string;
  locationName?: string;
  description?: string;
  photo?: string;
}

export interface RecordAssignment {
  aan: string;
  kind: AssignmentKind;
  status: AssignmentStatus;
  farmerId: string;
  farmerName: string;
  /** The service as the farmer booked it. */
  service: string;
  mode?: AppointmentMode;
  date?: string;
  slot?: string;
  meetingLink?: string;
  bookingId?: string;
  /** The incomplete registration, photos as uploaded URLs. */
  draft?: RegistrationDraft;
  /** The existing record, for maintenance. */
  animal?: AnimalSnapshot;
  updatedBy: string;
  updatedByName?: string;
  at: string;
  /** When the farmer handed it over (kept as the assignment moves on). */
  assignedAt?: string;
}

/** Still with the vet: shown in the vet's task list and as "Submitted to vet" to the farmer. */
export const ACTIVE_STATUSES: AssignmentStatus[] = ['submitted_to_vet', 'vet_in_progress'];

export function isActive(a: Pick<RecordAssignment, 'status'>): boolean {
  return ACTIVE_STATUSES.includes(a.status);
}

export function assignmentToAuditRow(a: RecordAssignment, actorId: string) {
  return { actor_id: actorId, action_type: ASSIGNMENT_ACTION, entity_type: 'animal', entity_id: a.aan, after: a };
}

export function assignmentFromAuditRow(row: { entity_id?: unknown; after?: unknown }): RecordAssignment | null {
  const a = row.after as Partial<RecordAssignment> | null | undefined;
  if (!a || typeof row.entity_id !== 'string' || !a.status || !a.kind || !a.farmerId || !a.at) return null;
  return { ...(a as RecordAssignment), aan: row.entity_id };
}

/** The current state of each assigned AAN: its newest row. */
export function latestAssignments(items: RecordAssignment[]): RecordAssignment[] {
  const byAan = new Map<string, RecordAssignment>();
  for (const a of items) {
    const prev = byAan.get(a.aan);
    if (!prev || a.at > prev.at) byAan.set(a.aan, a);
  }
  return [...byAan.values()].sort((x, y) => (x.at < y.at ? 1 : -1));
}

/** The same assignment moved on, keeping everything the earlier rows carried. */
export function nextAssignment(
  prev: RecordAssignment,
  status: AssignmentStatus,
  by: { id: string; name?: string },
  extra: Partial<RecordAssignment> = {},
  now = new Date(),
): RecordAssignment {
  return { ...prev, ...extra, status, updatedBy: by.id, updatedByName: by.name, at: now.toISOString() };
}

export function snapshotOf(a: Animal): AnimalSnapshot {
  return {
    name: a.name,
    tag: a.tag,
    breed: a.breed,
    color: a.color,
    sex: a.sex,
    dateOfBirth: a.dateOfBirth,
    locationName: a.locationName,
    description: a.description,
    photo: a.photos?.find((p) => /^https?:\/\//.test(p)),
  };
}

/** An animal the vet can edit, from a maintenance assignment, when the vet can't see the record itself. */
export function animalFromSnapshot(a: RecordAssignment, id: number): Animal {
  const s = a.animal ?? {};
  return {
    id,
    tag: s.tag ?? a.aan,
    name: s.name,
    breed: s.breed ?? { key: 'unknown', name: 'Unknown' },
    color: s.color,
    sex: s.sex,
    dateOfBirth: s.dateOfBirth ?? '',
    locationName: s.locationName,
    description: s.description,
    photos: s.photo ? [s.photo] : undefined,
    status: 'active',
    ngarenCode: a.aan,
    farmerId: a.farmerId,
  };
}

/* --------------------------- shared amendments --------------------------- */

export interface SharedAmendment extends AnimalAmendment {
  farmerId?: string;
}

export function amendmentToAuditRow(a: SharedAmendment, actorId: string) {
  return { actor_id: actorId, action_type: AMENDMENT_ACTION, entity_type: 'animal', entity_id: a.animalKey, after: a };
}

export function decisionToAuditRow(id: string, status: 'approved' | 'rejected', animalKey: string, actorId: string) {
  return { actor_id: actorId, action_type: AMENDMENT_DECISION_ACTION, entity_type: 'animal', entity_id: animalKey, after: { id, status } };
}

/** Amendments nobody has decided yet. */
export function pendingAmendments(
  amendments: SharedAmendment[],
  decisions: { id?: unknown; status?: unknown }[],
): SharedAmendment[] {
  const decided = new Set(decisions.map((d) => String(d.id)));
  return amendments.filter((a) => a.status === 'pending' && !decided.has(a.id));
}

/**
 * An approved amendment as `animal_lineage` columns. Only the fields the table
 * has; the rest (notes, saved location id) stay on the farmer's phone.
 */
export function lineagePatch(patch: Partial<Animal>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('name' in patch) out.animal_name = patch.name ?? null;
  if ('color' in patch) out.color = patch.color ?? null;
  if (patch.breed) out.animal_breed = patch.breed.name;
  if ('dateOfBirth' in patch) out.birth_date = patch.dateOfBirth || null;
  if ('locationName' in patch) out.farm_name = patch.locationName ?? null;
  if ('sex' in patch && patch.sex) out.sex = patch.sex;
  return out;
}
