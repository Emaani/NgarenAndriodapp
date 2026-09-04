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
  accountNumber?: string;
  farmerId?: string;
  farmerCode?: number;
  animalSequence?: number;
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
  /** Photo URIs (360°: front, left, right, back) — the primary animal ID. */
  photos?: string[];
  /** Internal Ngaren animal identifier stored separately from the displayed account number. */
  ngarenCode?: string;
  /** Coat colour / markings text descriptor. */
  color?: string;
  /** Tagging method (satellite | bluetooth | qr | manual) for device-type views. */
  taggingMethod?: string;
  /** Maker-checker state. Undefined is treated as approved (legacy records). */
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  /** Physical farm address where the animal is based (Address Line 1/2, City, Country). */
  physicalAddress?: string;
  /** Google geospatial coordinates of the animal's base — optional, mandatory for satellite tags. */
  coordinates?: { lat: number; lng: number };
  /** One or more tagging devices associated to this AAN. */
  devices?: RegisteredDevice[];
}

/** A tagging device associated to an animal's AAN (step 1d of AAN creation). */
export interface RegisteredDevice {
  /** Model type, e.g. 'Ceres Gen6' | 'Ceres Rancher' | 'Gsat Rancher' | 'Bluetooth'. */
  type: string;
  serial: string;
  supplier?: string;
  photo?: string | null;
  /** Satellite linkage route: Ngaren-assisted support, or self-linkage online. */
  linkage?: 'support' | 'self';
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

/**
 * A team member on the account (admin-managed). Mirrors the web app's
 * types/location.d.ts `User` for /api/ngaren/users 1:1.
 */
export interface TeamMember {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  roleKey?: number;
}

/** An assignable account role. Mirrors the web app's `UserRole`. */
export interface UserRole {
  key: number;
  name: string;
  code?: string;
  note?: string;
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

// Tracking is satellite-based; a herd may mix providers. The map is a common
// view across providers, while each provider can offer an enhanced view.
export type SatelliteProvider = 'Ceres Tag' | 'Digitanimal' | 'Other';

export interface AnimalMarker {
  animalId: number;
  tag: string;
  lat: number;
  lng: number;
  accuracy: 'Good' | 'Fair' | 'Poor';
  lastSeenMins: number;
  status: 'active' | 'inactive';
  provider?: SatelliteProvider;
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
  /** Professional persona (Aug 29 2026 standup) — resume-style profile fields. */
  credentials?: string;
  photo?: string;
  videoVisits?: boolean;
  selfPay?: boolean;
  institution?: string;
  tagline?: string;
  sponsored?: boolean;
  yearsExperience?: number;
}

/** A single day in a vet's booking calendar. `appts === 0` means closed. */
export interface VetDayAvailability {
  dateIso: string;
  appts: number;
  video: boolean;
}

/**
 * The Veterinary impact dashboard metrics (Aug 29 2026 standup). Counted from
 * the vet's completed work — visits, animals & farmers served, the nature of
 * services delivered, and the key field observations recorded.
 */
/** A row in an impact drill-down list. */
export interface VetImpactRow {
  label: string;
  sub?: string;
}

export interface VetImpact {
  totalVisits: number;
  animalsManaged: number;
  farmersServiced: number;
  services: { treatment: number; vaccination: number; stockTaking: number; others: number };
  observations: { ticks: number; flies: number; disease: number };
  /** Underlying records for the clickable tiles — present for the vet's own
   *  impact (from real records); omitted for browsed portfolio figures. */
  detail?: {
    visits: VetImpactRow[];
    animals: VetImpactRow[];
    farmers: VetImpactRow[];
  };
}

/** Full vet profile: persona + booking calendar + impact dashboard. */
export interface VetProfile extends Vet {
  availability: VetDayAvailability[];
  impact: VetImpact;
}

// Appointment priority — reduced to Routine / Emergency (Aug 29 2026 standup;
// the 'Soon' middle category was removed as redundant).
export type CalloutUrgency = 'Routine' | 'Emergency';
export type CalloutStatus = 'pending' | 'accepted' | 'declined' | 'completed';

/** How the vet attends the appointment (Aug 29 2026 standup). */
export type AppointmentMode = 'onsite' | 'video' | 'hybrid';

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
