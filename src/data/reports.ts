import { formatDate } from '@/lib/date';
import { toCsv } from '@/lib/export';
import { makeFarmerAnonymizer } from '@/lib/anon';
import { Animal, CalloutRequest, Device } from '@/data/types';
import { BreedingRecord, HealthRecord } from '@/data/clinical';

export type ReportKind = 'livestock' | 'devices' | 'health' | 'breeding' | 'vet_audit';

export interface ReportDef {
  id: ReportKind;
  name: string;
  description: string;
  icon: string;
}

/** The exportable report catalogue (mirrors the web ReportsPage tabs). */
export const REPORT_CATALOG: ReportDef[] = [
  {
    id: 'livestock',
    name: 'Livestock register',
    description: 'Every animal with tag, breed, location, DOB and status.',
    icon: 'cow',
  },
  {
    id: 'devices',
    name: 'Device inventory',
    description: 'All tags/devices with model, firmware and linkage.',
    icon: 'tag-outline',
  },
  {
    id: 'health',
    name: 'Health records',
    description: 'Treatments, vaccinations and follow-ups by animal.',
    icon: 'heart-pulse',
  },
  {
    id: 'vet_audit',
    name: 'Vet visits audit',
    description: 'Audit trail of vet requests — fulfilled vs unfulfilled visits.',
    icon: 'clipboard-check-outline',
  },
  {
    id: 'breeding',
    name: 'Breeding log (Phase 2)',
    description: 'Matings, expected calving and confirmed pregnancies.',
    icon: 'dna',
  },
];

/**
 * Audit-trail export (Sep 3 2026 standup): fulfilled vs unfulfilled vet visits,
 * chosen over automated escalation so management can review service delivery.
 */
export function vetAuditCsv(requests: CalloutRequest[]): string {
  const fulfilment = (s: string) =>
    s === 'completed' ? 'Fulfilled' : s === 'declined' ? 'Unfulfilled (declined)' : s === 'accepted' ? 'In progress' : 'Awaiting';
  const slaFor = (u: string) => (u === 'Emergency' ? '4h' : '48h');
  // Anonymized vet view (Sep 5 2026): farmers appear as stable pseudonyms.
  const aliasFor = makeFarmerAnonymizer();
  return toCsv(
    ['Animal', 'Farmer', 'Location', 'Priority', 'SLA', 'Status', 'Fulfilment', 'Requested', 'Distance (km)'],
    requests.map((r) => [
      r.animal,
      aliasFor(r.farmerName),
      r.locationName,
      r.urgency,
      slaFor(r.urgency),
      r.status,
      fulfilment(r.status),
      r.requestedAt,
      String(r.distanceKm),
    ]),
  );
}

export function animalsCsv(animals: Animal[]): string {
  return toCsv(
    ['Account Number', 'Internal ID', 'Farmer Tag', 'Name', 'Breed', 'Location', 'Date of birth', 'Status', 'Device', 'Dam', 'Sire'],
    animals.map((a) => [
      a.accountNumber ?? '',
      a.ngarenCode ?? '',
      a.tag,
      a.name ?? '',
      a.breed.name,
      a.locationName ?? '',
      formatDate(a.dateOfBirth),
      a.status,
      a.deviceSerial ?? '',
      a.damTag ?? '',
      a.sireTag ?? '',
    ]),
  );
}

export function devicesCsv(devices: Device[]): string {
  return toCsv(
    ['Serial', 'Model', 'Family', 'Brand', 'Firmware', 'Charge', 'Activated', 'Linked animal'],
    devices.map((d) => [
      d.serial,
      d.model,
      d.family,
      d.brand,
      d.firmware,
      d.chargeType,
      formatDate(d.activatedAt),
      d.linkedAnimalTag ?? '',
    ]),
  );
}

export function healthCsv(records: HealthRecord[]): string {
  return toCsv(
    ['Animal', 'Tag', 'Category', 'Vet', 'Severity', 'Medication', 'Status', 'Follow-up', 'Recorded'],
    records.map((r) => [
      r.animalName,
      r.tag ?? '',
      r.category,
      r.vetName ?? '',
      r.severity ?? '',
      r.medication ?? '',
      r.status,
      r.followUpDate ? formatDate(r.followUpDate) : '',
      formatDate(r.createdAt),
    ]),
  );
}

export function breedingCsv(records: BreedingRecord[]): string {
  return toCsv(
    ['Dam', 'Dam tag', 'Sire', 'Sire tag', 'Method', 'Mating date', 'Expected calving', 'Confirmed', 'Offspring', 'Status'],
    records.map((r) => [
      r.damName,
      r.damTag ?? '',
      r.sireName,
      r.sireTag ?? '',
      r.matingMethod,
      formatDate(r.matingDate),
      r.expectedCalvingDate ? formatDate(r.expectedCalvingDate) : '',
      r.pregnancyConfirmed ? 'Yes' : 'No',
      r.offspringCount,
      r.status,
    ]),
  );
}
