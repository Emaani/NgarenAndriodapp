/**
 * Direct messages on Supabase `direct_messages` (migration
 * docs/backend/0010_direct_messages_and_push.sql). Only the sender and the
 * recipient can read a message; the database adds a notification for the
 * recipient, which also goes to their phone as a push.
 *
 * Until the migration is applied the table is missing, and every call reports
 * `MessagingUnavailable` so the screen can say so instead of failing silently.
 */
import { supabase } from '../services/supabase';
import { isSupabaseConfigured } from '../config';
import { Contact, DirectMessage, MAX_MESSAGE_LENGTH } from '../lib/messages';

export class MessagingUnavailable extends Error {
  constructor() {
    super('Messaging is not switched on in the database yet');
  }
}

const COLS = 'id, sender_id, recipient_id, sender_name, body, created_at, read_at';

// PostgREST: table (PGRST205) or function (PGRST202) not in the schema yet.
const isMissing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === 'PGRST205' || e.code === 'PGRST202' || e.code === '42P01' || /does not exist|schema cache/i.test(e.message ?? ''));

async function me(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

export async function myUserId(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id;
}

/** Everyone the user can message: name and role only. */
export async function getContacts(): Promise<Contact[]> {
  if (!isSupabaseConfigured()) throw new MessagingUnavailable();
  const { data, error } = await supabase.rpc('get_message_contacts');
  if (isMissing(error)) throw new MessagingUnavailable();
  if (error) throw new Error(error.message);
  return ((data ?? []) as { user_id: string; full_name: string; role: string | null }[])
    .map((r) => ({ userId: r.user_id, name: r.full_name, role: r.role ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The user's recent messages, sent and received, newest first. */
export async function getMyMessages(limit = 500): Promise<DirectMessage[]> {
  if (!isSupabaseConfigured()) throw new MessagingUnavailable();
  const { data, error } = await supabase.from('direct_messages').select(COLS).order('created_at', { ascending: false }).limit(limit);
  if (isMissing(error)) throw new MessagingUnavailable();
  if (error) throw new Error(error.message);
  return (data ?? []) as DirectMessage[];
}

/** The conversation with one person, oldest first. */
export async function getThread(otherId: string): Promise<DirectMessage[]> {
  const mine = await me();
  const { data, error } = await supabase
    .from('direct_messages')
    .select(COLS)
    .or(`and(sender_id.eq.${mine},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${mine})`)
    .order('created_at', { ascending: true })
    .limit(500);
  if (isMissing(error)) throw new MessagingUnavailable();
  if (error) throw new Error(error.message);
  return (data ?? []) as DirectMessage[];
}

/** Send a message. Resolves with the stored message once the database has it. */
export async function sendMessage(recipientId: string, body: string, senderName: string): Promise<DirectMessage> {
  const text = body.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!text) throw new Error('Empty message');
  const { data, error } = await supabase
    .from('direct_messages')
    .insert({ recipient_id: recipientId, body: text, sender_name: senderName })
    .select(COLS)
    .single();
  if (isMissing(error)) throw new MessagingUnavailable();
  if (error) throw new Error(error.message);
  return data as DirectMessage;
}

/** Mark what the other person sent as read. */
export async function markThreadRead(otherId: string): Promise<void> {
  const mine = await me();
  await supabase
    .from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', mine)
    .eq('sender_id', otherId)
    .is('read_at', null)
    .then(() => undefined, () => undefined);
}

/** Unread messages for the user, for badges. 0 when messaging isn't available. */
export async function unreadMessageCount(): Promise<number> {
  try {
    const mine = await me();
    const { count, error } = await supabase
      .from('direct_messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', mine)
      .is('read_at', null);
    return error ? 0 : count ?? 0;
  } catch {
    return 0;
  }
}

/** Call `onMessage` for each new message to or from the user while subscribed. */
export function subscribeToMessages(onMessage: (m: DirectMessage) => void): () => void {
  const channel = supabase
    .channel(`dm-${Date.now()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => onMessage(payload.new as DirectMessage))
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
