/**
 * Permission vocabulary for delegated seats (P1).
 *
 * Mirrors the `permissions` catalog and `seat_role_permissions` templates in the
 * Supabase migration. Kept in code too so the app can gate features and resolve
 * an effective permission set even before the backend membership is loaded, and
 * so a user with NO organization membership (every current user) falls back to
 * their role's defaults — keeping existing behaviour unchanged.
 */
import { AppRole } from './roles';

export const PERMISSIONS = [
  'view_animals',
  'register_animal',
  'stock_take',
  'view_track',
  'book_vet',
  'view_health',
  'manage_breeding',
  'manage_devices',
  'manage_locations',
  'view_reports',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type SeatRole = 'owner' | 'farm_manager' | 'stockman' | 'viewer';

const ALL: Permission[] = [...PERMISSIONS];

/** Seat-role → permissions, mirroring seat_role_permissions seed rows. */
export const SEAT_ROLE_TEMPLATES: Record<SeatRole, Permission[]> = {
  owner: ALL,
  farm_manager: ALL,
  stockman: ['view_animals', 'stock_take', 'view_track'],
  viewer: ['view_animals', 'view_track', 'view_health', 'view_reports'],
};

/**
 * Fallback permissions when a user has no org membership. A solo farmer is their
 * own owner (full operational rights); a vet gets clinical read + call-outs;
 * platform admin is unrestricted (and additionally passes app_role gates for
 * platform-only screens).
 */
export const ROLE_FALLBACK_PERMISSIONS: Record<AppRole, Permission[]> = {
  admin: ALL,
  farmer: ALL,
  veterinary: ['view_animals', 'view_track', 'book_vet', 'view_health', 'view_reports'],
};

export const SEAT_ROLE_LABELS: Record<SeatRole, string> = {
  owner: 'Owner',
  farm_manager: 'Farm Manager',
  stockman: 'Stockman',
  viewer: 'Viewer',
};
