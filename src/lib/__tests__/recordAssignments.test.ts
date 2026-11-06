import {
  RecordAssignment,
  animalFromSnapshot,
  assignmentFromAuditRow,
  assignmentToAuditRow,
  isActive,
  latestAssignments,
  lineagePatch,
  nextAssignment,
  pendingAmendments,
  snapshotOf,
  SharedAmendment,
} from '@/lib/recordAssignments';
import { Animal } from '@/data/types';

const base: RecordAssignment = {
  aan: 'UG-1026-XWZJ8P',
  kind: 'registration',
  status: 'submitted_to_vet',
  farmerId: 'farmer-1',
  farmerName: 'Enumi',
  service: 'Animal registration & record maintenance',
  mode: 'hybrid',
  date: '2026-11-05',
  slot: '08:00–10:00',
  draft: { aan: 'UG-1026-XWZJ8P', name: 'Nga', createdAt: '2026-11-05T07:00:00Z', updatedAt: '2026-11-05T07:00:00Z' },
  updatedBy: 'farmer-1',
  at: '2026-11-05T08:00:00.000Z',
};

describe('record assignments', () => {
  it('round-trips through an audit-log row keyed by AAN', () => {
    const row = assignmentToAuditRow(base, 'farmer-1');
    expect(row).toMatchObject({ actor_id: 'farmer-1', action_type: 'record_assignment', entity_type: 'animal', entity_id: 'UG-1026-XWZJ8P' });
    expect(assignmentFromAuditRow(row)).toEqual(base);
    expect(assignmentFromAuditRow({ entity_id: 'X', after: { status: 'submitted_to_vet' } })).toBeNull();
  });

  it('keeps the newest state of each AAN', () => {
    const vet = nextAssignment(base, 'vet_in_progress', { id: 'vet-1', name: 'Dr Job' }, {}, new Date('2026-11-05T09:00:00Z'));
    const other = { ...base, aan: 'UG-1126-K9MWP2', at: '2026-11-04T08:00:00.000Z' };
    const latest = latestAssignments([base, other, vet]);
    expect(latest.map((a) => [a.aan, a.status])).toEqual([
      ['UG-1026-XWZJ8P', 'vet_in_progress'],
      ['UG-1126-K9MWP2', 'submitted_to_vet'],
    ]);
    // Moving on keeps what the farmer shared.
    expect(vet).toMatchObject({ farmerName: 'Enumi', mode: 'hybrid', draft: { name: 'Nga' }, updatedBy: 'vet-1', updatedByName: 'Dr Job' });
  });

  it('is with the vet until submitted for approval', () => {
    expect(isActive(base)).toBe(true);
    expect(isActive({ status: 'vet_in_progress' })).toBe(true);
    expect(isActive({ status: 'submitted_for_approval' })).toBe(false);
    expect(isActive({ status: 'approved' })).toBe(false);
  });

  it('lets the vet edit an animal it cannot see, from the copy the farmer sent', () => {
    const animal = {
      id: 7,
      tag: 'Enumi1',
      name: 'Nga',
      breed: { key: 'boran', name: 'Boran' },
      color: 'Brown',
      sex: 'male',
      dateOfBirth: '2026-11-05',
      status: 'active',
      photos: ['file:///local.jpg', 'https://x/y.jpg'],
      ngarenCode: 'UG-1126-K9MWP2',
    } as Animal;
    const snap = snapshotOf(animal);
    expect(snap.photo).toBe('https://x/y.jpg');
    const rebuilt = animalFromSnapshot({ ...base, kind: 'maintenance', aan: 'UG-1126-K9MWP2', animal: snap }, 99);
    expect(rebuilt).toMatchObject({ id: 99, ngarenCode: 'UG-1126-K9MWP2', name: 'Nga', breed: { name: 'Boran' }, farmerId: 'farmer-1', photos: ['https://x/y.jpg'] });
  });

  it('shows only undecided amendments', () => {
    const am = (id: string, status: SharedAmendment['status'] = 'pending'): SharedAmendment => ({
      id, animalId: 1, animalKey: 'A', animalLabel: 'A', changes: [], patch: {}, proposedBy: 'Dr', proposedAt: '', status,
    });
    expect(pendingAmendments([am('1'), am('2'), am('3', 'approved')], [{ id: '2', status: 'approved' }]).map((a) => a.id)).toEqual(['1']);
  });

  it('applies an approved change to the shared record columns only', () => {
    expect(
      lineagePatch({ name: 'Nga', color: 'Brown', breed: { key: 'boran', name: 'Boran' }, dateOfBirth: '', locationName: 'Kabwohe', description: 'x' }),
    ).toEqual({ animal_name: 'Nga', color: 'Brown', animal_breed: 'Boran', birth_date: null, farm_name: 'Kabwohe' });
  });
});
