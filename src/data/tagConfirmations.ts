/**
 * The latest confirmation per Bluetooth-tagged animal, read by the animal profile
 * and the device list. Stored on the device first, because stock-takes often run
 * without signal, then shared through Supabase `livestock_audit_log`, which every
 * role can read and write. Unsent records go up on the next read.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured } from '@/config';
import { mergeConfirmations, TagConfirmation } from '@/lib/tagConfirmation';
import { supabase } from '@/services/supabase';

const KEY = 'ngaren.local.tagconfirmations.v1';
const UNSENT_KEY = 'ngaren.local.tagconfirmations.unsent.v1';
const AUDIT_ACTION = 'tag_confirmed';
const REMOTE_LIMIT = 2000;

export function confirmationToAuditRow(c: TagConfirmation, actorId: string) {
  return { actor_id: actorId, action_type: AUDIT_ACTION, entity_type: 'animal', entity_id: c.animalKey, after: c };
}

export function confirmationFromAuditRow(row: { entity_id?: unknown; after?: unknown }): TagConfirmation | null {
  const c = row.after as Partial<TagConfirmation> | null | undefined;
  if (!c?.at || !c.by || !c.via || typeof row.entity_id !== 'string') return null;
  return { ...c, at: c.at, by: c.by, via: c.via, animalKey: row.entity_id };
}

async function readJson<T>(key: string, empty: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : empty;
  } catch {
    return empty;
  }
}

async function sendUnsent(): Promise<void> {
  const unsent = await readJson<TagConfirmation[]>(UNSENT_KEY, []);
  if (unsent.length === 0) return;
  const { data } = await supabase.auth.getSession();
  const actorId = data.session?.user.id;
  if (!actorId) return;
  const { error } = await supabase.from('livestock_audit_log').insert(unsent.map((c) => confirmationToAuditRow(c, actorId)));
  if (!error) await AsyncStorage.removeItem(UNSENT_KEY);
}

async function fetchShared(): Promise<TagConfirmation[]> {
  const { data, error } = await supabase
    .from('livestock_audit_log')
    .select('entity_id, after')
    .eq('action_type', AUDIT_ACTION)
    .order('created_at', { ascending: false })
    .limit(REMOTE_LIMIT);
  if (error || !data) return [];
  return data.map(confirmationFromAuditRow).filter((c): c is TagConfirmation => !!c);
}

export async function getTagConfirmations(): Promise<Record<string, TagConfirmation>> {
  const local = await readJson<Record<string, TagConfirmation>>(KEY, {});
  if (!isSupabaseConfigured()) return local;
  try {
    await sendUnsent();
    return mergeConfirmations(local, await fetchShared());
  } catch {
    return local;
  }
}

export async function addTagConfirmations(confirmations: TagConfirmation[]): Promise<void> {
  if (confirmations.length === 0) return;
  try {
    const existing = await readJson<Record<string, TagConfirmation>>(KEY, {});
    await AsyncStorage.setItem(KEY, JSON.stringify(mergeConfirmations(existing, confirmations)));
    const unsent = await readJson<TagConfirmation[]>(UNSENT_KEY, []);
    await AsyncStorage.setItem(UNSENT_KEY, JSON.stringify([...unsent, ...confirmations]));
    if (isSupabaseConfigured()) await sendUnsent();
  } catch {
    // best-effort
  }
}
