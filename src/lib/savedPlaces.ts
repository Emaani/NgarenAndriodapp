/**
 * Saved locations for animal onboarding. A location is captured once, then
 * reused: the picker offers the farmer's own farm, every place the herd is
 * already registered at, and any paddocks from the platform.
 *
 * Pure logic, so what counts as "the same location" is unit-tested.
 */
import { Animal, Location } from '../data/types';

export interface PlaceAddress {
  line1?: string;
  line2?: string;
  city?: string;
  country?: string;
}

/** A location as captured at registration. */
export interface PlaceDetails extends PlaceAddress {
  name?: string;
  locationId?: number;
  coords?: { lat: number; lng: number };
}

export interface SavedPlace extends PlaceDetails {
  key: string;
  label: string;
  source: 'account' | 'herd' | 'paddock';
  animalCount: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

/**
 * Older records only hold the joined "line1, line2, city, country" text. Every
 * address ends in the country, and a line-less one is just that (the country
 * field is pre-filled), which on its own doesn't identify a place.
 */
export function parsePhysicalAddress(text: string | null | undefined): PlaceAddress {
  const parts = (text ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { country: parts[0] };
  const country = parts[parts.length - 1];
  const city = parts[parts.length - 2];
  const [line1, ...rest] = parts.slice(0, -2);
  return { line1, line2: rest.join(', ') || undefined, city, country };
}

function detailsOf(a: Animal): PlaceDetails {
  return {
    ...(a.address ?? parsePhysicalAddress(a.physicalAddress)),
    name: a.locationName?.trim() || undefined,
    locationId: a.locationId,
    coords: a.coordinates,
  };
}

function labelOf(p: PlaceDetails): string {
  return p.name || p.line1 || p.city || '';
}

function keyOf(p: PlaceDetails): string {
  const identity = p.name ? [p.name] : [p.line1, p.city, p.country];
  return identity.map((s) => (s ?? '').trim().toLowerCase()).join('|');
}

/** Fill gaps from another record of the same place, keeping what's already known. */
function fill(into: PlaceDetails, from: PlaceDetails) {
  into.line1 ??= from.line1;
  into.line2 ??= from.line2;
  into.city ??= from.city;
  into.country ??= from.country;
  into.coords ??= from.coords;
  into.locationId ??= from.locationId;
}

/**
 * Distinct places the herd is registered at, most recently used first. Pass
 * local records first: the backend row of a synced animal only holds the name.
 */
export function herdPlaces(animals: Animal[]): SavedPlace[] {
  const seen = new Set<string>();
  const places = new Map<string, SavedPlace>();
  for (const a of animals) {
    const id = a.ngarenCode ?? String(a.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const details = detailsOf(a);
    const label = labelOf(details);
    if (!label) continue;
    const key = keyOf(details);
    const existing = places.get(key);
    if (existing) {
      existing.animalCount += 1;
      fill(existing, details);
    } else {
      places.set(key, { ...details, key, label, source: 'herd', animalCount: 1 });
    }
  }
  return [...places.values()];
}

/** The farmer's own location: the one they saved, else their farm's name. */
export function accountPlace(saved: PlaceDetails | null, farmName?: string | null): PlaceDetails | null {
  if (saved) return saved;
  const name = farmName?.trim();
  return name && !UUID.test(name) ? { name } : null;
}

export function hasPlaceDetails(p: PlaceDetails): boolean {
  return !!labelOf(p);
}

/** Everything the picker offers, in order: my farm, the herd, then paddocks. */
export function placeChoices(input: {
  account: PlaceDetails | null;
  animals: Animal[];
  paddocks: Location[];
}): SavedPlace[] {
  const herd = herdPlaces(input.animals);
  const choices: SavedPlace[] = [];
  const account = input.account && hasPlaceDetails(input.account) ? input.account : null;
  if (account) {
    const key = keyOf(account);
    const match = herd.find((p) => p.key === key);
    const place: SavedPlace = { ...account, key, label: labelOf(account), source: 'account', animalCount: match?.animalCount ?? 0 };
    if (match) fill(place, match);
    choices.push(place);
  }
  choices.push(...herd.filter((p) => !choices.some((c) => c.key === p.key)));
  for (const paddock of input.paddocks) {
    const key = keyOf({ name: paddock.name });
    const match = choices.find((c) => c.key === key);
    if (match) match.locationId ??= paddock.id;
    else choices.push({ key, label: paddock.name, name: paddock.name, locationId: paddock.id, source: 'paddock', animalCount: 0 });
  }
  return choices;
}
