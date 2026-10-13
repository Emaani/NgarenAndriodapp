/**
 * Internal messages composed in-app and sent to Ngaren Support or a farmer
 * (Oct 2026 Q&A). Stored on-device as a simple outbox so the compose portal is
 * fully functional offline; becomes a write-through to the messaging backend
 * when it lands.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ngaren.local.messages.v1';

export type MessageTarget = 'ngaren' | 'farmer';

export interface OutboxMessage {
  id: string;
  target: MessageTarget;
  /** Display name of the recipient (e.g. "Ngaren Support" or the farmer's name). */
  recipientName: string;
  /** Farmer id when target === 'farmer'. */
  recipientId?: string;
  subject: string;
  body: string;
  from: string;
  sentAt: string;
}

export async function getMessages(): Promise<OutboxMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as OutboxMessage[]) : [];
  } catch {
    return [];
  }
}

export async function sendMessage(msg: Omit<OutboxMessage, 'id' | 'sentAt'>): Promise<OutboxMessage> {
  const record: OutboxMessage = { ...msg, id: `msg-${Date.now()}`, sentAt: new Date().toISOString() };
  try {
    const all = await getMessages();
    await AsyncStorage.setItem(KEY, JSON.stringify([record, ...all]));
  } catch {
    // best-effort
  }
  return record;
}

/** Messages to a given target (for showing a simple thread/history). */
export async function getMessagesTo(target: MessageTarget, recipientId?: string): Promise<OutboxMessage[]> {
  const all = await getMessages();
  return all.filter((m) => m.target === target && (!recipientId || m.recipientId === recipientId));
}
