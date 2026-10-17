/**
 * General app event log (Oct 2026) — records actions like animal deletions so
 * they appear in the admin Audit Log ("Event Logs") alongside record amendments
 * and report exports. On-device; becomes a write-through to an events table when
 * the backend lands.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ngaren.local.auditevents.v1';

export type AuditEventType = 'animal_deleted' | 'other';

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  title: string;
  detail: string;
  by: string;
  at: string;
}

export async function getAuditEvents(): Promise<AuditEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AuditEvent[]) : [];
  } catch {
    return [];
  }
}

export async function logAuditEvent(input: { type: AuditEventType; title: string; detail: string; by: string }): Promise<void> {
  const entry: AuditEvent = { ...input, id: `ev-${Date.now()}`, at: new Date().toISOString() };
  try {
    const all = await getAuditEvents();
    await AsyncStorage.setItem(KEY, JSON.stringify([entry, ...all].slice(0, 200)));
  } catch {
    // best-effort
  }
}
