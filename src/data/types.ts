/**
 * Domain types mirroring the Nuxt platform web app (types/*.d.ts) and the
 * API Sync Map in MOBILE_WIREFRAME_SPEC §7. Keeping these aligned means the
 * backend phase only swaps the data source, not the screen code.
 */

export interface Breed {
  key: string;
  name: string;
}

export interface Animal {
  id: number;
  tag: string;
  name?: string;
  breed: Breed;
  locationId?: number;
  locationName?: string;
  deviceId?: number;
  deviceSerial?: string | null;
  dateOfBirth: string;
  status: 'active' | 'inactive';
  description?: string;
  damTag?: string;
  sireTag?: string;
}

export interface Location {
  id: number;
  name: string;
  address: string;
  sizeHa: number;
  animalCount: number;
  kind: 'paddock' | 'water' | 'yard';
}

export interface Device {
  id: number;
  serial: string;
  model: string;
  family: string;
  brand: string;
  firmware: string;
  chargeType: string;
  activatedAt: string;
  temperatureC: number | null;
  linkedAnimalId: number | null;
  linkedAnimalTag: string | null;
}

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: 'Admin' | 'Operator' | 'Viewer';
}

export type NotificationCategory = 'device' | 'boundary';

export interface AppNotification {
  id: number;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: string;
  unread: boolean;
}

export interface DashboardSummary {
  animals: number;
  devices: number;
  locations: number;
  users: number;
  allocation: { allocated: number; free: number };
  connectivity: { connected: number; unconnected: number };
}

export interface AnimalMarker {
  animalId: number;
  tag: string;
  lat: number;
  lng: number;
  accuracy: 'Good' | 'Fair' | 'Poor';
  lastSeenMins: number;
  status: 'active' | 'inactive';
}

export interface Vet {
  id: number;
  name: string;
  clinic: string;
  specialty: string;
  distanceKm: number;
  rating: number;
  reviews: number;
  available: boolean;
}

/** A single behaviour time-series for the detail charts. */
export interface BehaviourSeries {
  label: string;
  unit: string;
  actual: number[];
  pfi: number[];
}
