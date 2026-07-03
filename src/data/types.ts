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

/**
 * Flat Spring page envelope as the platform-api actually returns it (the page
 * metadata sits alongside `items`, not nested). The web app's stores read these
 * top-level fields directly, so we mirror that shape for 1:1 parity.
 */
export interface PageResponse<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  numberOfElements: number;
  totalElements: number;
  totalPages: number;
}

/* ----------------------------------------------------------------------------
 * Raw backend payloads — parity-exact with the Nuxt web app's types/*.d.ts.
 * The API client maps these into the UI-friendly types above so screen code
 * never changes between mock and live mode.
 * ------------------------------------------------------------------------- */

/** GET /api/ngaren/summary — the Live Stock Command Center aggregate. */
export interface SummaryData {
  totalAnimals: number;
  totalDevices: number;
  totalUsers: number;
  unlinkedDevices: number;
  linkedAnimals: number;
  totalLocations: number;
}

/** GET /api/ngaren/animals item (types/animal.d.ts AnimalResponsePayload). */
export interface AnimalResponsePayload {
  id: number;
  locationId?: number;
  deviceId?: number;
  breedKey?: string;
  breed?: { key: string; name: string };
  dateOfBirth: string | null;
  tag: string;
  etag?: string;
  status: string;
  description?: string;
  damId?: string;
  sireId?: string;
  dateCreated?: string;
  location?: { id: number; name: string };
  deviceAllocation?: { id: number | null; deviceSerialNumber: string };
}

/** GET /api/ngaren/breeds item (types/animal.d.ts Breed). */
export interface BackendBreed {
  key: number;
  code?: string;
  name: string;
  note?: string;
}

/** GET /api/ngaren/devices item (types/device.d.ts Device). */
export interface BackendDevice {
  id: number;
  serialNumber: string;
  vid?: string;
  brand: string;
  model: { key?: number | null; code?: string; name: string };
  family: string;
  firmwareVersion: string;
  chargeType: string;
  dateCreated: string;
  temperature?: number;
  linkedToAnimal: boolean;
  activationDate?: string;
}

/** POST /api/ngaren/devices body (types/device.d.ts DeviceInboundPayload). */
export interface DeviceInboundPayload {
  serialNumber: string;
  modelKey: number | null;
}

/** GET /api/ngaren/locations item (types/location.d.ts LocationResponsePayload). */
export interface LocationResponsePayload {
  id: number;
  name: string;
  address?: string;
  size: number;
  description?: string;
  features?: Array<{ id: number; label: string; featureType?: { key: number; name: string } }>;
  dateCreated?: string;
}

/** GET /api/ngaren/locationFeatureTypes item. */
export interface LocationFeatureType {
  key: number;
  name: string;
}

/** GET /api/ngaren/track item (types/animal.d.ts AnimalLocation). */
export interface BackendAnimalLocation {
  id: number;
  animalId: number;
  latitude: number;
  longitude: number;
  accuracy: string;
  timestamp: string;
}

/**
 * GET /api/ngaren/animals/{id}/data?dataKey=&startDate=&endDate= item
 * (types/animal.d.ts AnimalData). This is the raw Ceres Tag behaviour/telemetry
 * time series — grazing/resting/walking/drinking minutes, methane production,
 * dry matter intake — keyed by `dataKey` (see ANIMAL_DATA_KEYS in data/api.ts).
 */
export interface BackendAnimalData {
  id: number;
  value: string | number;
  type: string;
  timestamp: string;
}

/** GET /api/settings (types/app.d.ts UserSetting). */
export interface UserSetting {
  partyId?: number;
  deviceActivityConfig?: string;
  deviceTempConfig?: string;
  animalOutsideBoundaryConfig?: string;
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
