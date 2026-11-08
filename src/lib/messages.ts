/**
 * Direct messages between users (Nov 2026): rows of `direct_messages`, turned
 * into conversations (one per other person) for the Messages screen.
 */

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  sender_name: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface Contact {
  userId: string;
  name: string;
  /** e.g. "farmer", "veterinary", "admin" — comma-separated when several. */
  role: string;
}

export interface ConversationSummary {
  otherId: string;
  /** The other person's name, as their messages or the contact list give it. */
  name: string;
  last: DirectMessage;
  unread: number;
}

/** The person on the other side of a message. */
export const otherParty = (m: DirectMessage, me: string) => (m.sender_id === me ? m.recipient_id : m.sender_id);

/** One summary per person, newest conversation first. */
export function conversations(messages: DirectMessage[], me: string, contacts: Contact[] = []): ConversationSummary[] {
  const names = new Map(contacts.map((c) => [c.userId, c.name]));
  const byOther = new Map<string, ConversationSummary>();
  for (const m of messages) {
    const other = otherParty(m, me);
    const prev = byOther.get(other);
    const unread = (prev?.unread ?? 0) + (m.recipient_id === me && !m.read_at ? 1 : 0);
    const nameFromMessage = m.sender_id === other ? m.sender_name : null;
    const name = names.get(other) ?? prev?.name ?? nameFromMessage ?? 'Ngaren user';
    const last = !prev || m.created_at > prev.last.created_at ? m : prev.last;
    byOther.set(other, { otherId: other, name: prev && prev.name !== 'Ngaren user' ? prev.name : name, last, unread });
  }
  return [...byOther.values()].sort((a, b) => (a.last.created_at < b.last.created_at ? 1 : -1));
}

/** The role a contact is shown under. Ngaren staff are admins. */
export function roleOf(c: Pick<Contact, 'role'>): 'ngaren' | 'vet' | 'farmer' | 'other' {
  const roles = c.role.split(',');
  if (roles.includes('admin')) return 'ngaren';
  if (roles.includes('veterinary')) return 'vet';
  if (roles.includes('farmer')) return 'farmer';
  return 'other';
}

export const MAX_MESSAGE_LENGTH = 4000;
