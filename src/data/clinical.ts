/**
 * Clinical & operations data — Breeding, Managed Health and Calendar.
 *
 * These read the SAME Supabase tables as the Livestock Command Center
 * (breeding_records, health_records, health_timeline, vet_support_requests,
 * follow_up_reminders), so RLS scopes rows per role automatically — admins see
 * all, farmers see their own herd, vets see assigned cases — exactly like web.
 *
 * Every function degrades gracefully: when Supabase isn't configured, or a
 * query errors (offline / RLS / table not present), it returns mock data so the
 * screens stay usable in Demo Mode. Column contracts mirror the CC hooks
 * (useBreeding / useHealthRecords / useCalendarEvents) 1:1.
 */
import { supabase } from '../services/supabase';
import { isSupabaseConfigured } from '../config';
import { reportDataFailure, reportDataSuccess } from '../services/dataHealth';

export interface BreedingRecord {
  id: string;
  sireName: string;
  sireTag: string | null;
  damName: string;
  damTag: string | null;
  matingDate: string;
  matingMethod: string;
  expectedCalvingDate: string | null;
  pregnancyConfirmed: boolean;
  offspringCount: number;
  status: string;
  notes: string | null;
}

export type HealthCategory = 'parasite' | 'disease' | 'reproduction' | 'disorder';

export interface HealthRecord {
  id: string;
  animalName: string;
  tag: string | null;
  category: HealthCategory;
  vetName: string | null;
  severity: string | null;
  medication: string | null;
  status: string;
  followUpDate: string | null;
  notes: string | null;
  createdAt: string;
}

export type CalendarType = 'vet_visit' | 'vaccination' | 'follow_up' | 'tagging' | 'stock_take';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: CalendarType;
}

/* ------------------------------- mock data -------------------------------- */

const MOCK_BREEDING: BreedingRecord[] = [
  { id: 'b1', sireName: 'Bull #A-042', sireTag: 'A-042', damName: 'Cow #A-017', damTag: 'A-017', matingDate: '2026-02-10', matingMethod: 'Natural', expectedCalvingDate: '2026-11-17', pregnancyConfirmed: true, offspringCount: 0, status: 'confirmed', notes: 'Confirmed via ultrasound.' },
  { id: 'b2', sireName: 'AI Batch KB-77', sireTag: null, damName: 'Heifer #A-061', damTag: 'A-061', matingDate: '2026-03-02', matingMethod: 'Artificial Insemination', expectedCalvingDate: '2026-12-07', pregnancyConfirmed: false, offspringCount: 0, status: 'pending', notes: 'Awaiting 45-day check.' },
  { id: 'b3', sireName: 'Bull #A-042', sireTag: 'A-042', damName: 'Cow #A-008', damTag: 'A-008', matingDate: '2025-08-19', matingMethod: 'Natural', expectedCalvingDate: '2026-05-26', pregnancyConfirmed: true, offspringCount: 1, status: 'calved', notes: 'Healthy calf delivered.' },
];

const MOCK_HEALTH: HealthRecord[] = [
  { id: 'h1', animalName: 'Bull #A-042', tag: 'A-042', category: 'disease', vetName: 'Dr. Sarah Mwangi', severity: 'moderate', medication: 'Oxytetracycline', status: 'ongoing', followUpDate: '2026-07-20', notes: 'Mild respiratory infection; responding to treatment.', createdAt: '2026-07-06' },
  { id: 'h2', animalName: 'Heifer #A-061', tag: 'A-061', category: 'parasite', vetName: 'Dr. John Kamau', severity: 'low', medication: 'Ivermectin', status: 'resolved', followUpDate: null, notes: 'Routine deworming.', createdAt: '2026-06-28' },
  { id: 'h3', animalName: 'Cow #A-017', tag: 'A-017', category: 'reproduction', vetName: 'Dr. Sarah Mwangi', severity: null, medication: null, status: 'ongoing', followUpDate: '2026-08-01', notes: 'Pregnancy monitoring.', createdAt: '2026-06-15' },
];

const MOCK_CALENDAR: CalendarEvent[] = [
  { id: 'c1', title: 'Vet Visit: Respiratory check', date: '2026-07-20', type: 'vet_visit' },
  { id: 'c2', title: 'Follow-up: Bull #A-042', date: '2026-07-20', type: 'follow_up' },
  { id: 'c3', title: 'Vaccination due: North Paddock', date: '2026-07-25', type: 'vaccination' },
  { id: 'c4', title: 'Pregnancy check: Cow #A-017', date: '2026-08-01', type: 'follow_up' },
];

/* ----------------------------- live queries ------------------------------- */

/** Breeding records, newest mating first. */
export async function getBreedingRecords(): Promise<BreedingRecord[]> {
  if (!isSupabaseConfigured()) return MOCK_BREEDING;
  try {
    const { data, error } = await supabase
      .from('breeding_records')
      .select('*')
      .order('mating_date', { ascending: false });
    if (error || !data) {
      reportDataFailure('breeding', error);
      return MOCK_BREEDING;
    }
    reportDataSuccess();
    return data.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      sireName: (r.sire_name as string) ?? '—',
      sireTag: (r.sire_tag_id as string) ?? null,
      damName: (r.dam_name as string) ?? '—',
      damTag: (r.dam_tag_id as string) ?? null,
      matingDate: (r.mating_date as string) ?? '',
      matingMethod: (r.mating_method as string) ?? '—',
      expectedCalvingDate: (r.expected_calving_date as string) ?? null,
      pregnancyConfirmed: Boolean(r.pregnancy_confirmed),
      offspringCount: Number(r.offspring_count ?? 0),
      status: (r.status as string) ?? 'pending',
      notes: (r.notes as string) ?? null,
    }));
  } catch (e) {
    reportDataFailure('breeding', e);
    return MOCK_BREEDING;
  }
}

/** Managed-health records, newest first. */
export async function getHealthRecords(): Promise<HealthRecord[]> {
  if (!isSupabaseConfigured()) return MOCK_HEALTH;
  try {
    const { data, error } = await supabase
      .from('health_records')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data) {
      reportDataFailure('health', error);
      return MOCK_HEALTH;
    }
    reportDataSuccess();
    return data.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      animalName: (r.animal_name as string) ?? '—',
      tag: (r.tag_serial_id as string) ?? null,
      category: ((r.category as HealthCategory) ?? 'disease'),
      vetName: (r.vet_name as string) ?? null,
      severity: (r.severity as string) ?? null,
      medication: (r.medication as string) ?? null,
      status: (r.status as string) ?? 'ongoing',
      followUpDate: (r.follow_up_date as string) ?? null,
      notes: (r.notes as string) ?? null,
      createdAt: (r.created_at as string) ?? '',
    }));
  } catch (e) {
    reportDataFailure('health', e);
    return MOCK_HEALTH;
  }
}

/**
 * Upcoming calendar events, merged from health-record follow-ups and vet
 * support requests (mirrors useCalendarEvents' derivation). Sorted by date.
 */
export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  if (!isSupabaseConfigured()) return MOCK_CALENDAR;
  try {
    const events: CalendarEvent[] = [];

    const [{ data: visits }, { data: health }] = await Promise.all([
      supabase.from('vet_support_requests').select('*').not('preferred_date', 'is', null),
      supabase.from('health_records').select('*').not('follow_up_date', 'is', null),
    ]);

    (visits ?? []).forEach((r: Record<string, unknown>) => {
      events.push({
        id: `visit-${r.id}`,
        title: `Vet Visit: ${(r.issue_category as string) ?? 'Consultation'}`,
        date: r.preferred_date as string,
        type: 'vet_visit',
      });
    });

    (health ?? []).forEach((r: Record<string, unknown>) => {
      const isVax =
        (r.category as string) === 'disease' &&
        String(r.diagnosis_type ?? '').toLowerCase().includes('vaccin');
      events.push({
        id: `health-${r.id}`,
        title: isVax ? `Vaccination: ${(r.animal_name as string) ?? ''}` : `Follow-up: ${(r.animal_name as string) ?? ''}`,
        date: r.follow_up_date as string,
        type: isVax ? 'vaccination' : 'follow_up',
      });
    });

    reportDataSuccess();
    if (events.length === 0) return MOCK_CALENDAR;
    return events.sort((a, b) => a.date.localeCompare(b.date));
  } catch (e) {
    reportDataFailure('calendar', e);
    return MOCK_CALENDAR;
  }
}
