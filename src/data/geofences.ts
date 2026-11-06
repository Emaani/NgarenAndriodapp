/**
 * Farm boundaries from the shared Supabase `geofences` table, the same rows the
 * web command centre's Geofences page draws and edits.
 *
 * Everyone signed in can read them. Admins manage all of them; a farmer
 * manages the ones they created (`created_by`). Vets only read.
 *
 * Demo Mode (no Supabase) keeps the built-in demo paddocks. A live app with
 * no boundaries shows none rather than made-up ones.
 */
import { supabase } from '../services/supabase';
import { isSupabaseConfigured } from '../config';
import { reportDataFailure, reportDataSuccess } from '../services/dataHealth';
import { FenceDraft, GeofenceRow, buildGeofenceRow, rowToGeofence } from '../lib/geofenceShapes';
import { Geofence, geofences as demoFences } from './mock';

export async function getGeofenceRows(): Promise<GeofenceRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase.from('geofences').select('*').order('created_at', { ascending: false });
  if (error) {
    reportDataFailure('geofences', error);
    return [];
  }
  reportDataSuccess();
  return (data ?? []) as GeofenceRow[];
}

/** The boundaries the Track map checks against: active ones only. */
export async function getGeofences(): Promise<Geofence[]> {
  if (!isSupabaseConfigured()) return demoFences;
  const rows = await getGeofenceRows();
  return rows.filter((r) => r.active !== false).map(rowToGeofence).filter((f) => f.ring.length >= 3);
}

export async function getGeofenceRow(id: string): Promise<GeofenceRow | undefined> {
  if (!isSupabaseConfigured()) return undefined;
  const { data, error } = await supabase.from('geofences').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? undefined) as GeofenceRow | undefined;
}

/** Create (no id) or update a boundary. Throws with the database's reason on failure. */
export async function saveGeofence(draft: FenceDraft, userId: string, id?: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Boundaries need the live database.');
  const row = buildGeofenceRow(draft);
  const { error } = id
    ? await supabase.from('geofences').update(row).eq('id', id)
    : await supabase.from('geofences').insert({ ...row, created_by: userId });
  if (error) throw new Error(error.message);
}

export async function deleteGeofence(id: string): Promise<void> {
  const { error } = await supabase.from('geofences').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Who may change a boundary, mirroring the table's access rules. */
export function canEditFence(row: Pick<GeofenceRow, 'created_by'>, user: { id: string } | null, role: string): boolean {
  if (role === 'admin') return true;
  return role === 'farmer' && !!user && row.created_by === user.id;
}
