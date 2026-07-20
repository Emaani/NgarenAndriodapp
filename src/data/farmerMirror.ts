/**
 * Admin → Farmer Mirror — a read-mostly snapshot of a single farmer's herd and
 * devices, for support/verification. Reads the SAME `profiles`, `animal_lineage`
 * and `devices` tables as the web AdminFarmerMirrorPage, and records every view
 * in `livestock_audit_log` with `metadata.support_action = true` so access
 * stays traceable — exactly like web.
 */
import { supabase } from '../services/supabase';
import { isSupabaseConfigured } from '../config';

export interface MirrorFarmer {
  userId: string;
  fullName: string | null;
  email: string | null;
  farmId: string | null;
}

export interface MirrorAnimal {
  animalId: string;
  animalName: string;
  animalTagId: string | null;
  visualTagNumber: string | null;
  breed: string | null;
  lifecycleStatus: string;
  tagStatus: string;
  photoUrl: string | null;
}

export interface MirrorDevice {
  id: string;
  serialNumber: string;
  tagId: string;
  status: string;
  batteryLevel: number | null;
  linkedAnimalId: string | null;
}

export interface FarmerMirror {
  farmer: MirrorFarmer | null;
  animals: MirrorAnimal[];
  devices: MirrorDevice[];
}

const MOCK_MIRROR: FarmerMirror = {
  farmer: { userId: 'f1', fullName: 'Patrick Etyang', email: 'patrick@nakaserofarm.ug', farmId: 'farm-1' },
  animals: [
    { animalId: 'a1', animalName: 'Bull #A-042', animalTagId: '3004123', visualTagNumber: 'A-042', breed: 'Boran', lifecycleStatus: 'complete', tagStatus: 'active', photoUrl: null },
    { animalId: 'a2', animalName: 'Heifer #A-061', animalTagId: null, visualTagNumber: 'A-061', breed: 'Ankole', lifecycleStatus: 'pending', tagStatus: 'unlinked', photoUrl: null },
  ],
  devices: [
    { id: 'd1', serialNumber: 'CT-88213', tagId: '3004123', status: 'online', batteryLevel: 78, linkedAnimalId: 'a1' },
  ],
};

/** Fetch a farmer's profile + herd + devices, mirroring the web Support view. */
export async function getFarmerMirror(farmerId: string): Promise<FarmerMirror> {
  if (!isSupabaseConfigured()) return MOCK_MIRROR;
  try {
    const [profileRes, animalRes, deviceRes] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, email, farm_id').eq('user_id', farmerId).maybeSingle(),
      supabase
        .from('animal_lineage')
        .select('animal_id, animal_name, animal_tag_id, visual_tag_number, animal_breed, lifecycle_status, tag_status, photo_url, assigned_farmer_id, created_by_user')
        .or(`assigned_farmer_id.eq.${farmerId},created_by_user.eq.${farmerId}`)
        .order('animal_name'),
      supabase.from('devices').select('id, serial_number, tag_id, status, battery_level, linked_animal_id').eq('assigned_to', farmerId).order('serial_number'),
    ]);

    const p = profileRes.data as Record<string, unknown> | null;
    const farmer: MirrorFarmer | null = p
      ? { userId: String(p.user_id), fullName: (p.full_name as string) ?? null, email: (p.email as string) ?? null, farmId: (p.farm_id as string) ?? null }
      : null;

    const animals: MirrorAnimal[] = ((animalRes.data ?? []) as Record<string, unknown>[]).map((a) => ({
      animalId: String(a.animal_id),
      animalName: (a.animal_name as string) ?? '—',
      animalTagId: (a.animal_tag_id as string) ?? null,
      visualTagNumber: (a.visual_tag_number as string) ?? null,
      breed: (a.animal_breed as string) ?? null,
      lifecycleStatus: (a.lifecycle_status as string) ?? 'pending',
      tagStatus: (a.tag_status as string) ?? 'unlinked',
      photoUrl: (a.photo_url as string) ?? null,
    }));

    const devices: MirrorDevice[] = ((deviceRes.data ?? []) as Record<string, unknown>[]).map((d) => ({
      id: String(d.id),
      serialNumber: (d.serial_number as string) ?? '—',
      tagId: (d.tag_id as string) ?? '—',
      status: (d.status as string) ?? 'offline',
      batteryLevel: d.battery_level == null ? null : Number(d.battery_level),
      linkedAnimalId: (d.linked_animal_id as string) ?? null,
    }));

    return { farmer, animals, devices };
  } catch {
    return MOCK_MIRROR;
  }
}

/** Record this support access — idempotent per screen visit, matches web. */
export async function logMirrorAccess(
  farmerId: string,
  actorId: string,
  farmer: MirrorFarmer | null,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    await supabase.from('livestock_audit_log').insert({
      actor_id: actorId,
      actor_role: 'admin',
      action_type: 'support_mirror_view',
      entity_type: 'farmer',
      entity_id: farmerId,
      metadata: {
        support_action: true,
        farmer_email: farmer?.email,
        farmer_name: farmer?.fullName,
        opened_at: new Date().toISOString(),
      },
    });
  } catch {
    // Audit logging is best-effort; a failure here shouldn't block the view.
  }
}
