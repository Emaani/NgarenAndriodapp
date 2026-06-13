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
  deviceSerial?: string;
}

/**
 * Backend notification taxonomy — mirrors the platform-api enum that the Nuxt
 * web app consumes (types/notification.d.ts → Notification.type).
 */
export type NotificationType = 'DEVICE_ACTIVITY' | 'BOUNDARY_CHECK';

/**
 * Per-alert-type delivery channel. Parity-exact with the web app's
 * EmailNotificationSetting union (EMAIL | SMS | EMAIL_AND_SMS). Push is handled
 * device-side via expo-notifications and is not part of this enum.
 */
export type AlertChannel = 'EMAIL' | 'SMS' | 'EMAIL_AND_SMS';

/**
 * Notification preferences payload — matches the web app's
 * NotificationSettingsRequestPayload sent to POST/PUT /api/ngaren/notifications/settings.
 */
export interface NotificationSettings {
  deviceActivityConfig: AlertChannel;
  boundaryCheckAlertConfig: AlertChannel;
}

/** Raw backend notification shape (platform-api / web app types/notification.d.ts). */
export interface BackendNotification {
  id: number;
  type: string;
  deviceSerialNumber: string;
  description: string;
  dateCreated: string;
}

/** Spring-style page envelope returned by the BFF/platform-api. */
export interface Paginated<T> {
  items: T[];
  page: {
    pageNumber: number;
    pageSize: number;
    numberOfElements: number;
    totalElements: number;
    totalPages: number;
  };
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

export type CalloutUrgency = 'Routine' | 'Soon' | 'Emergency';
export type CalloutStatus = 'pending' | 'accepted' | 'declined' | 'completed';

/** An incoming vet call-out request — the unit of work in the vet persona. */
export interface CalloutRequest {
  id: number;
  farmerName: string;
  animal: string;
  locationName: string;
  distanceKm: number;
  urgency: CalloutUrgency;
  notes?: string;
  requestedAt: string;
  status: CalloutStatus;
}

/** A subscription plan shown on the Payments screen. */
export interface Plan {
  id: string;
  name: string;
  priceLabel: string;
  cadence: string;
  devicesIncluded: number;
  features: string[];
}

/** A past invoice line on the Payments screen. */
export interface Invoice {
  id: number;
  date: string;
  amount: string;
  status: 'Paid' | 'Due';
}

/** A single behaviour time-series for the detail charts. */
export interface BehaviourSeries {
  label: string;
  unit: string;
  actual: number[];
  pfi: number[];
}
