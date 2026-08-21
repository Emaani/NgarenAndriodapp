/**
 * The herd, sourced from Supabase `animal_lineage` — the SAME table the web
 * command centre and Ceres telemetry key on. This replaces the mock/platform-api
 * herd so animals are real and sync across mobile ↔ web, and so per-animal Ceres
 * telemetry links by the animal's `animal_tag_id`.
 *
 * Locally-onboarded animals (captured on-device, possibly not yet written back)
 * are merged on top. Degrades gracefully: not configured / query error → the
 * platform-api mock + local, so the app never breaks.
 */
import { supabase } from '../services/supabase';
import { isSupabaseConfigured } from '../config';
import { reportDataFailure, reportDataSuccess } from '../services/dataHealth';
import { getAnimals } from './api';
import { getLocalAnimalById, getLocalAnimals } from './localAnimals';
import { Animal } from './types';

/** Stable numeric id from a lineage uuid (48 bits — safe integer, collision-safe at farm scale). */
function uuidToId(uuid: string): number {
  const hex = uuid.replace(/[^0-9a-f]/gi, '').slice(0, 12) || '0';
  return parseInt(hex, 16);
}

function mapLineage(r: Record<string, unknown>): Animal {
  const breedName = (r.animal_breed as string) ?? '—';
  return {
    id: uuidToId(String(r.id)),
    tag: (r.visual_tag_number as string) ?? (r.animal_tag_id as string) ?? (r.animal_id as string) ?? '—',
    name: (r.animal_name as string) ?? undefined,
    breed: { key: breedName.toLowerCase().replace(/\s+/g, '-'), name: breedName },
    locationName: (r.farm_name as string) ?? undefined,
    dateOfBirth: (r.birth_date as string) ?? '',
    status: 'active',
    deviceSerial: (r.animal_tag_id as string) ?? null,
    ngarenCode: (r.animal_id as string) ?? undefined,
    damTag: (r.dam_name as string) ?? (r.dam_id as string) ?? undefined,
    sireTag: (r.sire_name as string) ?? (r.sire_id as string) ?? undefined,
    photos: r.photo_url ? [r.photo_url as string] : undefined,
    approvalStatus: (r.lifecycle_status as string) === 'complete' ? 'approved' : 'pending',
  };
}

/** The full herd: live animal_lineage (or platform-api fallback) + local, newest local first. */
export async function getHerd(): Promise<Animal[]> {
  const local = await getLocalAnimals();
  if (!isSupabaseConfigured()) {
    const remote = await getAnimals();
    return [...local, ...remote];
  }
  try {
    const { data, error } = await supabase
      .from('animal_lineage')
      .select('id, animal_id, animal_name, animal_tag_id, visual_tag_number, animal_breed, birth_date, dam_name, dam_id, sire_name, sire_id, photo_url, farm_name, lifecycle_status')
      .order('created_at', { ascending: false });
    if (error || !data) {
      reportDataFailure('herd', error);
      const remote = await getAnimals();
      return [...local, ...remote];
    }
    reportDataSuccess();
    // Local animals not yet reflected in animal_lineage sit on top (dedupe by AAN).
    const remote = data.map(mapLineage);
    const remoteCodes = new Set(remote.map((a) => a.ngarenCode).filter(Boolean));
    const localUnsynced = local.filter((a) => !a.ngarenCode || !remoteCodes.has(a.ngarenCode));
    return [...localUnsynced, ...remote];
  } catch (e) {
    reportDataFailure('herd', e);
    const remote = await getAnimals();
    return [...local, ...remote];
  }
}

/** One animal by numeric id — local first, then the live/backend herd. */
export async function getHerdAnimalById(id: number): Promise<Animal | undefined> {
  const localHit = await getLocalAnimalById(id);
  if (localHit) return localHit;
  return (await getHerd()).find((a) => a.id === id);
}

/**
 * Best-effort approval write-through: when the Field-Operations checker approves
 * a captured animal, mark its lineage row `complete` so the web command centre
 * (and Ceres linkage) sees it finalised. Rejection stays local — animal_lineage
 * has no "rejected" lifecycle, so a rejected capture simply never finalises.
 * No-ops (and returns false) when Supabase isn't configured or the row isn't
 * present yet (e.g. the maker's role couldn't insert it).
 */
export async function setLineageApproval(
  aan: string | undefined,
  status: 'approved' | 'rejected',
): Promise<boolean> {
  if (!isSupabaseConfigured() || !aan || status !== 'approved') return false;
  try {
    const { error } = await supabase
      .from('animal_lineage')
      .update({ lifecycle_status: 'complete' })
      .eq('animal_id', aan);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Best-effort write-through of a newly created AAN into animal_lineage so it
 * syncs to the web command centre. Requires an insert-capable role (admin/vet);
 * for others it no-ops and the animal remains local. Only http(s) photo URLs are
 * persisted (local file URIs are device-only — see the Storage upload step).
 */
export async function syncAnimalToLineage(
  animal: Animal,
  userId?: string,
  uploadedPhotoUrls?: string[],
): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) return false;
  try {
    const remotePhoto =
      uploadedPhotoUrls?.[0] ?? (animal.photos ?? []).find((p) => /^https?:\/\//.test(p));
    const { error } = await supabase.from('animal_lineage').insert({
      animal_id: animal.ngarenCode ?? animal.tag,
      animal_name: animal.name ?? animal.tag,
      animal_tag_id: animal.deviceSerial ?? null,
      visual_tag_number: animal.tag,
      animal_breed: animal.breed.name,
      birth_date: animal.dateOfBirth || null,
      sex: 'unknown',
      photo_url: remotePhoto ?? null,
      assigned_farmer_id: userId,
      created_by_user: userId,
      lifecycle_status: animal.approvalStatus === 'approved' ? 'complete' : 'in_progress',
      tag_status: animal.deviceSerial ? 'assigned' : 'unassigned',
      farm_name: animal.locationName ?? null,
    });
    return !error;
  } catch {
    return false;
  }
}
