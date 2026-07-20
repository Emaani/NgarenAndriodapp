import { formatDate } from '@/lib/date';
import { toCsv } from '@/lib/export';
import { Animal, Device } from '@/data/types';
import { BreedingRecord, HealthRecord } from '@/data/clinical';

export type ReportKind = 'livestock' | 'devices' | 'health' | 'breeding';

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
    id: 'breeding',
    name: 'Breeding log',
    description: 'Matings, expected calving and confirmed pregnancies.',
    icon: 'dna',
  },
];

export function animalsCsv(animals: Animal[]): string {
  return toCsv(
    ['Tag', 'Name', 'Breed', 'Location', 'Date of birth', 'Status', 'Device', 'Dam', 'Sire'],
    animals.map((a) => [
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
