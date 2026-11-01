/**
 * Device, location and dashboard figures worked out from the herd. Builds have no
 * platform API and Supabase's `devices` table still holds the web app's seeded
 * tags, so an animal's own record is what says which tags and places are real.
 *
 * Pure logic, so a dashboard count and the list it opens always agree.
 */
import { Animal, DashboardSummary, Device, Location, RegisteredDevice } from '../data/types';
import { textToId } from './ids';
import { herdPlaces } from './savedPlaces';
import { deviceModel } from './tagging';

export function locationKind(name: string): Location['kind'] {
  const lower = name.toLowerCase();
  if (lower.includes('water')) return 'water';
  return lower.includes('yard') ? 'yard' : 'paddock';
}

function brandOf(type: string, supplier?: string): string {
  if (supplier) return supplier;
  if (/^ela\b/i.test(type)) return 'ELA Innovation';
  if (/^ceres\b/i.test(type)) return 'Ceres Tag';
  if (/^gsat\b/i.test(type)) return 'Gsat';
  return '—';
}

/** Connected tags only: a visual ear tag isn't a device. */
function connectedTags(a: Animal): RegisteredDevice[] {
  const listed = (a.devices ?? []).filter((d) => deviceModel(d.type)?.method !== 'manual');
  if (listed.length > 0 || a.devices?.length) return listed;
  return a.deviceSerial ? [{ type: a.taggingMethod === 'bluetooth' ? 'Bluetooth' : 'Satellite tag', serial: a.deviceSerial }] : [];
}

export function devicesFromHerd(animals: Animal[]): Device[] {
  const bySerial = new Map<string, Device>();
  for (const a of animals) {
    for (const tag of connectedTags(a)) {
      if (!tag.serial || bySerial.has(tag.serial)) continue;
      bySerial.set(tag.serial, {
        id: textToId(tag.serial),
        serial: tag.serial,
        model: tag.type,
        family: deviceModel(tag.type)?.method === 'bluetooth' ? 'Bluetooth' : 'Satellite',
        brand: brandOf(tag.type, tag.supplier),
        firmware: '—',
        chargeType: '—',
        activatedAt: '',
        temperatureC: null,
        linkedAnimalId: a.id,
        linkedAnimalTag: a.name ?? a.tag,
      });
    }
  }
  return [...bySerial.values()];
}

export function locationsFromHerd(animals: Animal[]): Location[] {
  return herdPlaces(animals).map((p) => ({
    id: textToId(p.key),
    name: p.label,
    address: [p.line1, p.city, p.country].filter(Boolean).join(', '),
    sizeHa: 0,
    animalCount: p.animalCount,
    kind: locationKind(p.label),
  }));
}

export function summaryFromHerd(animals: Animal[]): DashboardSummary {
  const devices = devicesFromHerd(animals).length;
  const connected = animals.filter((a) => connectedTags(a).length > 0).length;
  return {
    animals: animals.length,
    devices,
    locations: locationsFromHerd(animals).length,
    users: 0,
    allocation: { allocated: devices, free: 0 },
    connectivity: { connected, unconnected: animals.length - connected },
  };
}
