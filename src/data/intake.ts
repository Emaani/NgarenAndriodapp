/**
 * Intake intelligence for the herd: each satellite-tagged animal's weight and
 * breed from `animal_lineage`, and its CERES daily summaries (`record_type =
 * 'pfi'`) from `ceres_telemetry`, as the web's Intake Intelligence page reads.
 */
import { supabase } from '../services/supabase';
import { isSupabaseConfigured } from '../config';
import { reportDataFailure, reportDataSuccess } from '../services/dataHealth';
import { uuidToId } from '../lib/ids';
import { IntakeAssessment, PfiRow, assessIntake, pfiInputs } from '../lib/intake';

export interface IntakeEntry extends IntakeAssessment {
  animalId: number;
  label: string;
  breed: string | null;
  tagId: string;
}

const COLON_MAC = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i;
const DAYS = 15;

export async function getHerdIntake(): Promise<IntakeEntry[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data: herd, error } = await supabase
      .from('animal_lineage')
      .select('id, animal_id, animal_name, animal_tag_id, visual_tag_number, animal_breed, weight_kg')
      .not('animal_tag_id', 'is', null);
    if (error) throw error;
    const animals = (herd ?? []).filter((a) => a.animal_tag_id && !COLON_MAC.test(a.animal_tag_id));
    if (animals.length === 0) return [];

    const tags = [...new Set(animals.map((a) => String(a.animal_tag_id).trim()))];
    const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
    const rows: PfiRow[] = [];
    for (let i = 0; i < tags.length; i += 100) {
      const { data, error: e2 } = await supabase
        .from('ceres_telemetry')
        .select('animal_tag_id, recorded_at, dry_matter_intake_kg_per_day, feed_intake_kg, ruminating_mins, resting_and_ruminating_mins')
        .eq('record_type', 'pfi')
        .in('animal_tag_id', tags.slice(i, i + 100))
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: false })
        .limit(1000);
      if (e2) throw e2;
      rows.push(...((data ?? []) as PfiRow[]));
    }
    const inputs = pfiInputs(rows);
    reportDataSuccess();

    return animals.map((a) => {
      const tagId = String(a.animal_tag_id).trim();
      const p = inputs.get(tagId);
      return {
        ...assessIntake({
          weightKg: typeof a.weight_kg === 'number' ? a.weight_kg : null,
          breed: a.animal_breed ?? null,
          measuredDmiKg: p?.measuredDmiKg ?? null,
          ruminationRecent: p?.ruminationRecent ?? null,
          ruminationBaseline: p?.ruminationBaseline ?? null,
        }),
        animalId: uuidToId(String(a.id)),
        label: a.visual_tag_number || a.animal_name || a.animal_id || tagId,
        breed: a.animal_breed ?? null,
        tagId,
      };
    });
  } catch (e) {
    reportDataFailure('intake', e);
    return [];
  }
}
