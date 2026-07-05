/**
 * Ngaren API client — 1:1 parity with the Nuxt web app (ngaren-platform-webapp).
 *
 * Every method hits the exact same BFF / platform-api endpoint, verb and query
 * contract the web app's Pinia stores use, so the mobile app, the web app and
 * the shared database stay in lock-step (the "Live Stock Command Center"):
 *
 *   Command Center / dashboard
 *     GET  /api/ngaren/summary                                  (dashboardStore)
 *   Animals
 *     GET  /api/ngaren/animals?pageNumber=&pageSize=            (animalStore)
 *     GET  /api/ngaren/animals/{id}
 *     POST /api/ngaren/animals
 *     GET  /api/ngaren/breeds
 *     GET  /api/ngaren/animals/{id}/data?dataKey=&startDate=&endDate=  (Ceres behaviour telemetry)
 *   Track (live locations)
 *     GET  /api/ngaren/track?pageNumber=&pageSize=&latestOnly=true&startDate=&endDate= (trackStore)
 *   Devices
 *     GET  /api/ngaren/devices?pageNumber=&pageSize=&allDevices= (deviceStore)
 *     GET  /api/ngaren/devices/{id}
 *     POST /api/ngaren/devices
 *     GET  /api/device-models
 *     POST /api/animals/{animalId}/device-allocations
 *     GET  /api/sync/devices                                    (Ceres sync trigger)
 *   Locations (farms)
 *     GET  /api/ngaren/locations?pageNumber=&pageSize=          (locationStore)
 *     GET  /api/ngaren/locationFeatureTypes
 *   Notifications & settings
 *     GET  /api/notifications?pageNumber=&pageSize=             (notificationStore)
 *     GET  /api/settings                                        (configStore)
 *     POST /api/settings/notifications                          (notificationStore)
 *   Mobile-only additions (push + vet call-outs)
 *     POST /api/ngaren/notifications/push-tokens
 *     GET/POST/PATCH /api/ngaren/callouts
 *
 * Every request carries the `X-Ngaren-Consumer-Id` header (OIDC userid claim),
 * matching the web BFF proxy contract (server/api/[...].ts).
 *
 * When no backend is configured (isBackendConfigured() === false) every method
 * resolves against src/data/mock.ts, so the UI is fully functional offline and
 * goes live the moment the env vars are set — no screen code changes needed.
 */
import { config, isBackendConfigured } from '../config';
import * as mock from './mock';
import {
  AlertChannel,
  Animal,
  AnimalMarker,
  AnimalResponsePayload,
  AppNotification,
  BackendAnimalData,
  BackendAnimalLocation,
  BackendBreed,
  BackendDevice,
  BackendNotification,
  BehaviourSeries,
  CalloutRequest,
  CalloutStatus,
  CalloutUrgency,
  DashboardSummary,
  Device,
  DeviceInboundPayload,
  Location,
  LocationFeatureType,
  LocationResponsePayload,
  NotificationCategory,
  NotificationSettings,
  Paginated,
  PageResponse,
  SummaryData,
  UserSetting,
} from './types';

const DEFAULT_SETTINGS: NotificationSettings = {
  deviceActivityConfig: 'EMAIL_AND_SMS',
  boundaryCheckAlertConfig: 'EMAIL_AND_SMS',
};

/** Mutable in-memory copy so mock-mode "save" round-trips visibly. */
let mockSettings: NotificationSettings = { ...DEFAULT_SETTINGS };

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Ngaren-Consumer-Id': config.consumerId,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${config.platformUrl}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...headers(), ...(init?.headers as Record<string, string>) },
  });
  if (!res.ok) {
    // platform-api returns RFC7807 problem+json; surface a useful message.
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // non-JSON body; keep the status line
    }
    throw new Error(`Request failed: ${detail}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

/* ============================================================================
 * Command Center / dashboard summary
 * ========================================================================== */

/**
 * Maps the backend SummaryData onto the dashboard's DashboardSummary. The web
 * app's home page reads these same six counters; we additionally derive the
 * allocation/connectivity splits the mobile header visualises.
 */
export function mapSummary(s: SummaryData): DashboardSummary {
  // Same derivations as the web dashboard (pages/index.vue): allocation splits
  // devices (allocated vs free), connectivity splits animals (linked vs not).
  const allocatedDevices = Math.max(0, (s.totalDevices ?? 0) - (s.unlinkedDevices ?? 0));
  const connectedAnimals = s.linkedAnimals ?? 0;
  const unconnectedAnimals = Math.max(0, (s.totalAnimals ?? 0) - connectedAnimals);
  return {
    animals: s.totalAnimals ?? 0,
    devices: s.totalDevices ?? 0,
    locations: s.totalLocations ?? 0,
    users: s.totalUsers ?? 0,
    allocation: { allocated: allocatedDevices, free: s.unlinkedDevices ?? 0 },
    connectivity: { connected: connectedAnimals, unconnected: unconnectedAnimals },
  };
}

/** Fetch the Live Stock Command Center summary. Falls back to mock offline. */
export async function getSummary(): Promise<DashboardSummary> {
  if (!isBackendConfigured()) return mock.summary;
  const data = await request<SummaryData>('/api/ngaren/summary');
  return mapSummary(data);
}

/* ============================================================================
 * Animals
 * ========================================================================== */

/** Maps a raw backend animal onto the UI Animal type used across the screens. */
export function mapAnimal(a: AnimalResponsePayload): Animal {
  const status = (a.status ?? '').toLowerCase();
  return {
    id: a.id,
    tag: a.tag,
    name: a.description || a.tag,
    breed: { key: a.breed?.key ?? a.breedKey ?? '', name: a.breed?.name ?? '—' },
    locationId: a.location?.id ?? a.locationId,
    locationName: a.location?.name,
    deviceId: a.deviceId,
    deviceSerial: a.deviceAllocation?.deviceSerialNumber || null,
    dateOfBirth: typeof a.dateOfBirth === 'string' ? a.dateOfBirth : '',
    status: status === 'inactive' ? 'inactive' : 'active',
    description: a.description,
    damTag: a.damId,
    sireTag: a.sireId,
  };
}

/** Fetch a page of animals. Falls back to mock data offline. */
export async function getAnimals(pageNumber = 0, pageSize = 50): Promise<Animal[]> {
  if (!isBackendConfigured()) return mock.animals;
  const data = await request<PageResponse<AnimalResponsePayload>>(
    `/api/ngaren/animals?pageNumber=${pageNumber}&pageSize=${pageSize}`,
  );
  return (data.items ?? []).map(mapAnimal);
}

/** Fetch a single animal by id. Falls back to the mock list offline. */
export async function getAnimalById(id: number): Promise<Animal | undefined> {
  if (!isBackendConfigured()) return mock.animals.find((a) => a.id === id);
  const data = await request<AnimalResponsePayload>(`/api/ngaren/animals/${id}`);
  return mapAnimal(data);
}

export interface RegisterAnimalPayload {
  tag: string;
  breedKey?: string;
  locationId?: number;
  dateOfBirth?: string | null;
  description?: string;
  damId?: string;
  sireId?: string;
}

/** Register a new animal (POST /api/ngaren/animals). No-op resolve in mock mode. */
export async function registerAnimal(payload: RegisterAnimalPayload): Promise<Animal | null> {
  if (!isBackendConfigured()) return null;
  const data = await request<AnimalResponsePayload>('/api/ngaren/animals', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return mapAnimal(data);
}

export interface BreedOption {
  key: string;
  name: string;
}

/**
 * Fetch the breed catalogue as { key, name } options used by the registration
 * picker. Mock mode synthesises keys from the names so the same submit path
 * works offline and live.
 */
export async function getBreeds(): Promise<BreedOption[]> {
  if (!isBackendConfigured()) {
    return mock.breeds.map((name) => ({ key: name.toLowerCase(), name }));
  }
  const data = await request<BackendBreed[]>('/api/ngaren/breeds');
  return (data ?? []).map((b) => ({ key: String(b.key), name: b.name }));
}

/**
 * Ceres Tag behaviour-data keys (types/animal.d.ts AnimalAttributes + the
 * `dataKey` numbers the web app's animalStore.ts actually sends). "PFI" is the
 * platform's benchmark/prior-farm-index comparison series shown alongside the
 * animal's actual values.
 */
const ANIMAL_DATA_KEYS = {
  grazingMinutes: 1,
  restingMinutes: 2,
  walkingMinutes: 3,
  otherMinutes: 4,
  drinkingMinutes: 11,
  dryMatterIntake: 12,
  methaneProduction: 13,
  grazingMinutesPFI: 14,
  restingMinutesPFI: 15,
  walkingMinutesPFI: 16,
  drinkingMinutesPFI: 17,
  dryMatterIntakePFI: 18,
  methaneProductionPFI: 19,
} as const;

/** Fetch one raw Ceres data series for an animal. Empty array offline or on error. */
async function getAnimalDataSeries(
  animalId: number,
  dataKey: number,
  startDate: Date,
  endDate: Date,
): Promise<BackendAnimalData[]> {
  if (!isBackendConfigured()) return [];
  try {
    const data = await request<{ items: BackendAnimalData[] }>(
      `/api/ngaren/animals/${animalId}/data?dataKey=${dataKey}` +
        `&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
    );
    return data.items ?? [];
  } catch {
    // A given series (e.g. no PFI benchmark configured yet) failing shouldn't
    // blank out the rest of the animal's behaviour data.
    return [];
  }
}

function toSortedValues(items: BackendAnimalData[]): number[] {
  return [...items]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((i) => Number(i.value));
}

/**
 * Fetch the animal's Ceres Tag behaviour telemetry — grazing/resting/walking/
 * drinking minutes, methane production, dry matter intake, each with its PFI
 * benchmark — as the six BehaviourSeries the animal detail screen's ChartCards
 * render. Falls back to mock.behaviourSeries offline (or if the animal simply
 * has no synced data yet, in which case every series comes back empty and the
 * screen should show its own "no Ceres data yet" empty state).
 */
export async function getAnimalBehaviour(animalId: number, days = 14): Promise<BehaviourSeries[]> {
  if (!isBackendConfigured()) return mock.behaviourSeries;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  const fetchPair = async (actualKey: number, pfiKey: number) => {
    const [actual, pfi] = await Promise.all([
      getAnimalDataSeries(animalId, actualKey, startDate, endDate),
      getAnimalDataSeries(animalId, pfiKey, startDate, endDate),
    ]);
    return { actual: toSortedValues(actual), pfi: toSortedValues(pfi) };
  };

  const [grazing, resting, walking, drinking, methane, dryMatter] = await Promise.all([
    fetchPair(ANIMAL_DATA_KEYS.grazingMinutes, ANIMAL_DATA_KEYS.grazingMinutesPFI),
    fetchPair(ANIMAL_DATA_KEYS.restingMinutes, ANIMAL_DATA_KEYS.restingMinutesPFI),
    fetchPair(ANIMAL_DATA_KEYS.walkingMinutes, ANIMAL_DATA_KEYS.walkingMinutesPFI),
    fetchPair(ANIMAL_DATA_KEYS.drinkingMinutes, ANIMAL_DATA_KEYS.drinkingMinutesPFI),
    fetchPair(ANIMAL_DATA_KEYS.methaneProduction, ANIMAL_DATA_KEYS.methaneProductionPFI),
    fetchPair(ANIMAL_DATA_KEYS.dryMatterIntake, ANIMAL_DATA_KEYS.dryMatterIntakePFI),
  ]);

  return [
    { label: 'Grazing Minutes', unit: 'min', ...grazing },
    { label: 'Resting Minutes', unit: 'min', ...resting },
    { label: 'Walking Minutes', unit: 'min', ...walking },
    { label: 'Drinking Minutes', unit: 'min', ...drinking },
    { label: 'Methane Production', unit: 'g/day', ...methane },
    { label: 'Dry Matter Intake', unit: 'kg/day', ...dryMatter },
  ];
}

/* ============================================================================
 * Track — live animal locations
 * ========================================================================== */

function mapAccuracy(raw: string): AnimalMarker['accuracy'] {
  // The platform API reports Ceres GPS accuracy as enums (LESS_THAN_2_METERS …
  // GREATER_THAN_100_METERS, NO_GPS_ACCURACY), same values the web track page maps.
  const v = (raw ?? '').toLowerCase();
  if (v.includes('less_than_2') || v.includes('less_than_5') || v.includes('less_than_10')) return 'Good';
  if (v.includes('less_than_25') || v.includes('less_than_50')) return 'Fair';
  if (v.includes('less_than_100') || v.includes('greater_than_100') || v.includes('no_gps')) return 'Poor';
  // Fallback for any free-text accuracy values
  if (v.includes('good') || v.includes('high')) return 'Good';
  if (v.includes('poor') || v.includes('low')) return 'Poor';
  return 'Fair';
}

function minutesSince(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

/** Maps a backend animal-location ping onto the map's AnimalMarker. */
export function mapAnimalLocation(loc: BackendAnimalLocation): AnimalMarker {
  return {
    animalId: loc.animalId,
    tag: `#${loc.animalId}`,
    lat: Number(loc.latitude),
    lng: Number(loc.longitude),
    accuracy: mapAccuracy(loc.accuracy),
    lastSeenMins: minutesSince(loc.timestamp),
    status: 'active',
  };
}

/**
 * Fetch the latest animal location for each animal, matching the web trackStore
 * window (latest-only over the last 7 days). Falls back to mock markers offline.
 */
export async function getAnimalLocations(
  pageNumber = 0,
  pageSize = 100,
  locationIds?: number[],
): Promise<AnimalMarker[]> {
  if (!isBackendConfigured()) return mock.markers;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 7);
  const locParam = locationIds?.length ? `&locationIds=${locationIds.join(',')}` : '';
  const data = await request<{ items: BackendAnimalLocation[] }>(
    `/api/ngaren/track?pageNumber=${pageNumber}&pageSize=${pageSize}&latestOnly=true${locParam}` +
      `&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
  );
  return (data.items ?? []).map(mapAnimalLocation);
}

/* ============================================================================
 * Devices
 * ========================================================================== */

/** Maps a raw backend device onto the UI Device type the cards render. */
export function mapDevice(d: BackendDevice): Device {
  return {
    id: d.id,
    serial: d.serialNumber,
    model: d.model?.name ?? '—',
    family: d.family,
    brand: d.brand,
    firmware: d.firmwareVersion,
    chargeType: d.chargeType,
    activatedAt: d.activationDate ?? d.dateCreated,
    temperatureC: typeof d.temperature === 'number' ? d.temperature : null,
    // The devices list endpoint exposes link state as a boolean, not the animal
    // id (same as the web app). We surface the state; navigation to the animal
    // only happens in mock mode where the id is known.
    linkedAnimalId: null,
    linkedAnimalTag: d.linkedToAnimal ? 'Linked' : null,
  };
}

/** Fetch a page of devices. Falls back to mock data offline. */
export async function getDevices(
  pageNumber = 0,
  pageSize = 50,
  allDevices = true,
): Promise<Device[]> {
  if (!isBackendConfigured()) return mock.devices;
  const data = await request<PageResponse<BackendDevice>>(
    `/api/ngaren/devices?pageNumber=${pageNumber}&pageSize=${pageSize}&allDevices=${allDevices}`,
  );
  return (data.items ?? []).map(mapDevice);
}

/** Fetch a single device by id. Falls back to mock offline. */
export async function getDeviceById(id: number): Promise<Device | undefined> {
  if (!isBackendConfigured()) return mock.devices.find((d) => d.id === id);
  const data = await request<BackendDevice>(`/api/ngaren/devices/${id}`);
  return mapDevice(data);
}

/** Register a new device (POST /api/ngaren/devices). No-op resolve in mock mode. */
export async function saveDevice(payload: DeviceInboundPayload): Promise<Device | null> {
  if (!isBackendConfigured()) return null;
  const data = await request<BackendDevice>('/api/ngaren/devices', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return mapDevice(data);
}

/** Fetch the device-model catalogue (GET /api/device-models). */
export async function getDeviceModels(
  pageNumber = 0,
  pageSize = 50,
): Promise<Array<{ key: number; name: string }>> {
  if (!isBackendConfigured()) return [];
  const data = await request<PageResponse<{ key: number; name: string }>>(
    `/api/device-models?pageNumber=${pageNumber}&pageSize=${pageSize}`,
  );
  return data.items ?? [];
}

/** Link a device to an animal (POST /api/animals/{animalId}/device-allocations). */
export async function linkDeviceToAnimal(animalId: number, deviceId: number): Promise<void> {
  if (!isBackendConfigured()) return;
  await request<void>(`/api/animals/${animalId}/device-allocations`, {
    method: 'POST',
    body: JSON.stringify({ deviceId }),
  });
}

/**
 * Trigger the server-side Ceres Tag device sync. The actual Ceres satellite
 * integration is entirely server-side; the client only asks the backend to pull
 * the latest device/telemetry data into the shared DB. Mirrors the web app's
 * GET /api/sync/devices exactly.
 */
export async function syncDevices(): Promise<void> {
  if (!isBackendConfigured()) return;
  await request<void>('/api/sync/devices', { method: 'GET' });
}

/* ============================================================================
 * Locations (farms)
 * ========================================================================== */

/** Maps a backend location onto the UI Location type the cards render. */
export function mapLocation(l: LocationResponsePayload): Location {
  const name = (l.name ?? '').toLowerCase();
  const kind: Location['kind'] = name.includes('water')
    ? 'water'
    : name.includes('yard')
      ? 'yard'
      : 'paddock';
  return {
    id: l.id,
    name: l.name,
    address: l.address ?? '',
    sizeHa: Number(l.size ?? 0),
    // The list endpoint doesn't carry a per-location animal count; the map and
    // detail screens resolve that from the track/animals data when live.
    animalCount: 0,
    kind,
  };
}

/** Fetch a page of locations. Falls back to mock data offline. */
export async function getLocations(pageNumber = 0, pageSize = 50): Promise<Location[]> {
  if (!isBackendConfigured()) return mock.locations;
  const data = await request<PageResponse<LocationResponsePayload>>(
    `/api/ngaren/locations?pageNumber=${pageNumber}&pageSize=${pageSize}`,
  );
  return (data.items ?? []).map(mapLocation);
}

/** Fetch the location-feature-type catalogue. Empty offline. */
export async function getLocationFeatureTypes(): Promise<LocationFeatureType[]> {
  if (!isBackendConfigured()) return [];
  const data = await request<PageResponse<LocationFeatureType>>('/api/ngaren/locationFeatureTypes');
  return data.items ?? [];
}

/* ============================================================================
 * Notifications & settings
 * ========================================================================== */

/**
 * Maps a raw backend notification onto the UI-friendly AppNotification.
 * Backend `type` (DEVICE_ACTIVITY | BOUNDARY_CHECK) drives the category, icon
 * and human title used across the cards.
 */
export function mapNotification(n: BackendNotification): AppNotification {
  const isBoundary = n.type === 'BOUNDARY_CHECK';
  const category: NotificationCategory = isBoundary ? 'boundary' : 'device';
  const title = isBoundary ? 'Animal Outside Boundary' : 'Device Activity';
  return {
    id: n.id,
    category,
    title,
    message: n.description,
    timestamp: formatTimestamp(n.dateCreated),
    unread: true,
    deviceSerial: n.deviceSerialNumber,
  };
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

/** Fetch a page of notifications. Falls back to mock data offline. */
export async function getNotifications(
  pageNumber = 0,
  pageSize = 20,
): Promise<AppNotification[]> {
  if (!isBackendConfigured()) {
    return mock.notifications;
  }
  const data = await request<PageResponse<BackendNotification>>(
    `/api/notifications?pageNumber=${pageNumber}&pageSize=${pageSize}`,
  );
  return (data.items ?? []).map(mapNotification);
}

/** Count of currently unread notifications, used by the bell badge. */
export async function getUnreadCount(): Promise<number> {
  const list = await getNotifications(0, 50);
  return list.filter((n) => n.unread).length;
}

/** Fetch the current per-alert-type channel preferences (GET /api/settings). */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  if (!isBackendConfigured()) {
    return { ...mockSettings };
  }
  const s = await request<UserSetting>('/api/settings');
  return {
    deviceActivityConfig: (s.deviceActivityConfig as AlertChannel) ?? DEFAULT_SETTINGS.deviceActivityConfig,
    boundaryCheckAlertConfig:
      (s.animalOutsideBoundaryConfig as AlertChannel) ?? DEFAULT_SETTINGS.boundaryCheckAlertConfig,
  };
}

/** Persist updated channel preferences (POST /api/settings/notifications). */
export async function updateNotificationSettings(
  payload: NotificationSettings,
): Promise<NotificationSettings> {
  if (!isBackendConfigured()) {
    mockSettings = { ...payload };
    return { ...mockSettings };
  }
  await request<unknown>('/api/settings/notifications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return { ...payload };
}

/**
 * Register an Expo push token with the backend so the server can deliver push
 * alerts alongside the existing EMAIL/SMS channels. No-op in mock mode.
 */
export async function registerPushToken(
  token: string,
  platform: 'ios' | 'android' | 'web',
): Promise<void> {
  if (!isBackendConfigured()) return;
  await request<void>('/api/ngaren/notifications/push-tokens', {
    method: 'POST',
    body: JSON.stringify({ token, platform }),
  });
}

/* ============================================================================
 * Vet call-outs (mobile-first work queue)
 * ========================================================================== */

export interface CalloutRequestPayload {
  vetId?: number;
  animal: string;
  locationName: string;
  urgency: CalloutUrgency;
  notes?: string;
}

/** Fetch the vet's incoming call-out requests. Falls back to mock offline. */
export async function getCalloutRequests(
  pageNumber = 0,
  pageSize = 50,
): Promise<CalloutRequest[]> {
  if (!isBackendConfigured()) {
    return mock.calloutRequests;
  }
  const data = await request<Paginated<CalloutRequest>>(
    `/api/ngaren/callouts?pageNumber=${pageNumber}&pageSize=${pageSize}`,
  );
  return data.items ?? [];
}

/** Submit a new call-out request (farmer side). No-op in mock mode. */
export async function submitCalloutRequest(payload: CalloutRequestPayload): Promise<void> {
  if (!isBackendConfigured()) return;
  await request<void>('/api/ngaren/callouts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Update a call-out's status (vet accepts / declines / completes). No-op in mock mode. */
export async function updateCalloutStatus(id: number, status: CalloutStatus): Promise<void> {
  if (!isBackendConfigured()) return;
  await request<void>(`/api/ngaren/callouts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export const CHANNEL_LABELS: Record<AlertChannel, string> = {
  EMAIL: 'Email',
  SMS: 'SMS',
  EMAIL_AND_SMS: 'Email & SMS',
};
