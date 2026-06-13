/**
 * Ngaren API client.
 *
 * Talks to the same BFF / platform-api endpoints the Nuxt web app uses, so the
 * mobile app stays 1:1 with the web app and the shared database:
 *   GET  /api/ngaren/notifications?pageNumber=&pageSize=
 *   GET  /api/ngaren/notifications/settings
 *   PUT  /api/ngaren/notifications/settings
 *   POST /api/ngaren/notifications/push-tokens   (mobile push registration)
 *   POST /api/sync/devices                       (server-side Ceres sync trigger)
 *
 * Every request carries the `X-Ngaren-Consumer-Id` header (OIDC userid claim),
 * matching the web BFF proxy contract.
 *
 * When no backend is configured (isBackendConfigured() === false) every method
 * resolves against src/data/mock.ts, so the UI is fully functional offline and
 * goes live the moment the env vars are set — no screen code changes needed.
 */
import { config, isBackendConfigured } from '../config';
import * as mock from './mock';
import {
  AlertChannel,
  AppNotification,
  BackendNotification,
  CalloutRequest,
  CalloutStatus,
  CalloutUrgency,
  NotificationCategory,
  NotificationSettings,
  Paginated,
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
  const data = await request<Paginated<BackendNotification>>(
    `/api/ngaren/notifications?pageNumber=${pageNumber}&pageSize=${pageSize}`,
  );
  return (data.items ?? []).map(mapNotification);
}

/** Count of currently unread notifications, used by the bell badge. */
export async function getUnreadCount(): Promise<number> {
  const list = await getNotifications(0, 50);
  return list.filter((n) => n.unread).length;
}

/** Fetch the current per-alert-type channel preferences. */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  if (!isBackendConfigured()) {
    return { ...mockSettings };
  }
  return request<NotificationSettings>('/api/ngaren/notifications/settings');
}

/** Persist updated channel preferences. */
export async function updateNotificationSettings(
  payload: NotificationSettings,
): Promise<NotificationSettings> {
  if (!isBackendConfigured()) {
    mockSettings = { ...payload };
    return { ...mockSettings };
  }
  return request<NotificationSettings>('/api/ngaren/notifications/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
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

/**
 * Trigger the server-side Ceres Tag device sync. The actual Ceres satellite
 * integration is entirely server-side; the client only asks the backend to
 * pull the latest device/telemetry data into the shared DB.
 */
export async function syncDevices(): Promise<void> {
  if (!isBackendConfigured()) return;
  await request<void>('/api/sync/devices', { method: 'POST' });
}

/**
 * Vet call-out requests — the work queue powering the vet persona, and the
 * sink for a farmer's "Request a Call-out" submission.
 *   GET   /api/ngaren/callouts?pageNumber=&pageSize=   (vet inbox)
 *   POST  /api/ngaren/callouts                          (farmer submits)
 *   PATCH /api/ngaren/callouts/{id}                     (vet accepts/declines)
 * All env-gated with mock fallback, identical to the notifications client.
 */
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
