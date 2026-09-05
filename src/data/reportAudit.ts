/**
 * Report audit trail — every report a vet/admin generates & shares is recorded
 * for accountability (Sep 3 2026 standup: audit-trail over automated
 * escalation). Persisted on-device and, best-effort, written to the shared
 * `livestock_audit_log` (same pattern as the Support-mirror access log) so the
 * export is traceable server-side too.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { isSupabaseConfigured } from '../config';

const KEY = 'ngaren.report.audit.v1';

export interface ReportAuditEntry {
  id: string;
  report: string; // human-readable report name
  subject?: string; // e.g. the animal / scope the report covered
  rows: number; // record count included
  by: string; // who generated it
  at: string; // ISO timestamp
  shared: boolean; // whether the share sheet opened successfully
}

export async function getReportAudit(): Promise<ReportAuditEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReportAuditEntry[]) : [];
  } catch {
    return [];
  }
}

export async function logReportExport(input: {
  report: string;
  subject?: string;
  rows: number;
  by: string;
  actorId?: string;
  shared: boolean;
}): Promise<void> {
  const entry: ReportAuditEntry = {
    id: `rpt-${Date.now()}`,
    report: input.report,
    subject: input.subject,
    rows: input.rows,
    by: input.by,
    at: new Date().toISOString(),
    shared: input.shared,
  };
  try {
    const existing = await getReportAudit();
    // Keep the most recent 100 locally.
    await AsyncStorage.setItem(KEY, JSON.stringify([entry, ...existing].slice(0, 100)));
  } catch {
    // best-effort
  }
  // Best-effort server-side audit trail.
  if (isSupabaseConfigured() && input.actorId) {
    try {
      await supabase.from('livestock_audit_log').insert({
        actor_id: input.actorId,
        actor_role: 'veterinary',
        action_type: 'report_export',
        entity_type: 'report',
        entity_id: input.report,
        metadata: {
          report: input.report,
          subject: input.subject,
          rows: input.rows,
          shared: input.shared,
          at: entry.at,
        },
      });
    } catch {
      // Non-blocking — the local audit entry still stands.
    }
  }
}
