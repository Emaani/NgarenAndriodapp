jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../../services/supabase', () => ({ supabase: {} }));

import { alertText, calloutToRow, requestedAgo, rowToCallout, statusFromRow, takenByAnotherVet } from '../callouts';

const booking = {
  vetName: 'Dr. Sarah Namukasa',
  animal: 'Zara',
  animalTag: 'UG-1026-K7Q2MX',
  animalSex: 'female',
  animalBreed: 'Ankole',
  locationName: 'Home kraal',
  urgency: 'Emergency' as const,
  notes: 'Not grazing since morning.',
  mode: 'video' as const,
  service: 'Treatment, Consultation',
  scheduledFor: '2026-11-03',
  scheduledSlot: '08:00–10:00',
  accessScope: 'selected' as const,
  accessAnimals: ['Zara', 'Amara'],
};
const ROW_ID = '3f2b1c9e-1234-4abc-9def-001122334455';

describe('calloutToRow', () => {
  const row = calloutToRow(booking, 'farmer-1');

  it('matches the columns the web app reads', () => {
    expect(row).toMatchObject({
      requester_id: 'farmer-1',
      preferred_date: '2026-11-03',
      urgency: 'urgent',
      issue_category: 'Treatment',
      issue_description: 'Not grazing since morning.',
      animal_name: 'Zara',
      animal_tag: 'UG-1026-K7Q2MX',
    });
  });

  it('leaves the vet open, because Find a Vet is not linked to accounts', () => {
    expect(row.preferred_vet_id).toBeNull();
    expect(row.additional_notes).toContain('Preferred vet: Dr. Sarah Namukasa');
  });

  it('always fills the required description', () => {
    expect(calloutToRow({ animal: 'Zara', locationName: 'Farm', urgency: 'Routine' }, 'f').issue_description).toBe('Vet visit requested');
    expect(calloutToRow({ animal: 'Zara', locationName: 'Farm', urgency: 'Routine', service: 'Tagging' }, 'f').issue_description).toBe('Tagging');
  });

  it('sends a routine request with the web value', () => {
    expect(calloutToRow({ ...booking, urgency: 'Routine' }, 'f').urgency).toBe('routine');
  });
});

describe('rowToCallout', () => {
  it('reads back everything a booking captured', () => {
    const row = { ...calloutToRow(booking, 'farmer-1'), id: ROW_ID, status: 'pending', created_at: new Date().toISOString() };
    expect(rowToCallout(row, 'Kabwohe SACCO')).toMatchObject({
      farmerName: 'Kabwohe SACCO',
      animal: 'Zara',
      locationName: 'Home kraal',
      urgency: 'Emergency',
      status: 'pending',
      scheduledFor: '2026-11-03',
      scheduledSlot: '08:00–10:00',
      mode: 'video',
      service: 'Treatment, Consultation',
      distanceKm: 0,
    });
  });

  it('copes with a booking made on the web', () => {
    const webRow = {
      id: ROW_ID,
      animal_name: 'Bella',
      urgency: 'soon',
      status: 'accepted',
      issue_category: 'Lameness',
      issue_description: 'Limping',
      additional_notes: 'Please call first',
      created_at: '2026-10-01T10:00:00.000Z',
    };
    expect(rowToCallout(webRow, undefined)).toMatchObject({
      farmerName: 'Farmer',
      locationName: 'Farm',
      urgency: 'Routine',
      status: 'accepted',
      notes: 'Limping',
    });
    expect(rowToCallout(webRow, undefined).mode).toBeUndefined();
  });

  it('keeps ids stable across reloads', () => {
    const row = { id: ROW_ID, created_at: '2026-10-01T10:00:00.000Z' };
    expect(rowToCallout(row, undefined).id).toBe(rowToCallout(row, undefined).id);
    expect(Number.isSafeInteger(rowToCallout(row, undefined).id)).toBe(true);
  });
});

describe('what the vet sees', () => {
  const tagged = {
    ...booking,
    farmerName: 'Kabwohe SACCO',
    service: 'Consultation, Artificial Insemination',
    notes: '[Purpose: Advice, AI] [Meeting link: https://meet.jit.si/x] [Access: 1 animal] [Slot: 3 Nov 08:00] Not grazing.',
  };
  const row = { ...calloutToRow(tagged, 'farmer-1'), id: ROW_ID, created_at: '2026-10-01T10:00:00.000Z' };

  it('names the farmer from the booking, because vets cannot read profiles', () => {
    expect(rowToCallout(row, undefined).farmerName).toBe('Kabwohe SACCO');
    expect(rowToCallout(row, 'From profile').farmerName).toBe('From profile');
  });

  it('keeps every requested service, not just the first', () => {
    expect(rowToCallout(row, undefined).service).toContain('Artificial Insemination');
    expect(row.issue_category).toBe('Consultation');
  });

  it('drops repeated tags but keeps what only the note carries', () => {
    expect(rowToCallout(row, undefined).notes).toBe('[Meeting link: https://meet.jit.si/x] [Access: 1 animal] Not grazing.');
  });

  it('leaves no note when only tags were written', () => {
    expect(rowToCallout({ ...row, issue_description: '[Purpose: Advice]' }, undefined).notes).toBeUndefined();
  });
});

describe('alertText', () => {
  it('leaves only the farmer’s own words in the vet’s alert', () => {
    expect(alertText('[Purpose: Animal health] [Access: 1 animal] [Meeting link: https://meet.jit.si/x] Not grazing.')).toBe('Not grazing.');
  });

  it('keeps brackets a farmer typed that are not tags', () => {
    expect(alertText('Limping [left leg]')).toBe('Limping [left leg]');
  });
});

describe('statusFromRow', () => {
  it('maps every status onto what the screens handle', () => {
    expect(statusFromRow('pending')).toBe('pending');
    expect(statusFromRow('in_progress')).toBe('accepted');
    expect(statusFromRow('COMPLETED')).toBe('completed');
    expect(statusFromRow('cancelled')).toBe('declined');
    expect(statusFromRow(null)).toBe('pending');
  });
});

describe('takenByAnotherVet', () => {
  it('hides only jobs assigned to someone else', () => {
    expect(takenByAnotherVet({ preferred_vet_id: null }, 'vet-1')).toBe(false);
    expect(takenByAnotherVet({ preferred_vet_id: 'vet-1' }, 'vet-1')).toBe(false);
    expect(takenByAnotherVet({ preferred_vet_id: 'vet-2' }, 'vet-1')).toBe(true);
    expect(takenByAnotherVet({ preferred_vet_id: 'vet-2', requester_id: 'vet-1' }, 'vet-1')).toBe(false);
  });
});

describe('requestedAgo', () => {
  const now = Date.parse('2026-11-01T12:00:00.000Z');
  const ago = (ms: number) => requestedAgo(new Date(now - ms).toISOString(), now);

  it('reads like the rest of the app', () => {
    expect(ago(20_000)).toBe('Just now');
    expect(ago(10 * 60_000)).toBe('10 min ago');
    expect(ago(3_600_000)).toBe('1 hour ago');
    expect(ago(24 * 3_600_000)).toBe('Yesterday');
    expect(ago(3 * 24 * 3_600_000)).toBe('3 days ago');
    expect(requestedAgo('not a date', now)).toBe('');
  });
});
