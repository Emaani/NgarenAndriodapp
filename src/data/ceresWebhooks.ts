/**
 * CERES Webhook Monitor (Admin) — reads the SAME `ceres_webhook_log` table as
 * the web CeresWebhookMonitorPage, so RLS scoping is identical (admin sees all
 * deliveries). Replay calls the same `ceres-webhook` edge function the web app
 * uses to re-run a stored delivery.
 */
import { supabase } from '../services/supabase';
import { isSupabaseConfigured } from '../config';

export interface WebhookLog {
  id: string;
  webhookType: string;
  payload: unknown;
  status: string;
  receivedAt: string;
  processedAt: string | null;
  errorMessage: string | null;
  retryCount: number;
  persistedCount: number;
  duplicateCount: number;
  delayedCount: number;
  senderVerified: boolean;
  verificationMethod: string | null;
  sourceClass: string | null;
  authError: string | null;
}

export interface IngestionSummary {
  total: number;
  processed: number;
  failed: number;
  duplicate: number;
  uniqueTags: number;
  lastReceived: string | null;
  byType: Record<string, number>;
}

const MOCK_LOGS: WebhookLog[] = [
  { id: 'w1', webhookType: 'standard', payload: { ESN: '3004123', Behaviour: 'Grazing', BatteryPct: 78 }, status: 'processed', receivedAt: '2026-07-20T06:12:00Z', processedAt: '2026-07-20T06:12:04Z', errorMessage: null, retryCount: 0, persistedCount: 1, duplicateCount: 0, delayedCount: 0, senderVerified: true, verificationMethod: 'hmac', sourceClass: 'cerestag', authError: null },
  { id: 'w2', webhookType: 'alerts', payload: { ESN: '3004128', AlertType: 'GeofenceBreach' }, status: 'processed', receivedAt: '2026-07-20T05:40:00Z', processedAt: '2026-07-20T05:40:02Z', errorMessage: null, retryCount: 0, persistedCount: 1, duplicateCount: 0, delayedCount: 0, senderVerified: true, verificationMethod: 'hmac', sourceClass: 'cerestag', authError: null },
  { id: 'w3', webhookType: 'pfi', payload: { ESN: '3004123', PFI: 62 }, status: 'failed', receivedAt: '2026-07-20T04:55:00Z', processedAt: null, errorMessage: 'Unknown animal_tag_id mapping', retryCount: 2, persistedCount: 0, duplicateCount: 0, delayedCount: 0, senderVerified: true, verificationMethod: 'hmac', sourceClass: 'cerestag', authError: null },
];

function mapRow(r: Record<string, unknown>): WebhookLog {
  return {
    id: String(r.id),
    webhookType: (r.webhook_type as string) ?? 'unknown',
    payload: r.payload,
    status: (r.status as string) ?? 'pending',
    receivedAt: (r.received_at as string) ?? '',
    processedAt: (r.processed_at as string) ?? null,
    errorMessage: (r.error_message as string) ?? null,
    retryCount: Number(r.retry_count ?? 0),
    persistedCount: Number(r.persisted_count ?? 0),
    duplicateCount: Number(r.duplicate_count ?? 0),
    delayedCount: Number(r.delayed_count ?? 0),
    senderVerified: Boolean(r.sender_verified),
    verificationMethod: (r.verification_method as string) ?? null,
    sourceClass: (r.source_class as string) ?? null,
    authError: (r.auth_error as string) ?? null,
  };
}

/** Last 100 webhook deliveries, newest first. Optionally filtered by type. */
export async function getWebhookLogs(type?: string): Promise<WebhookLog[]> {
  if (!isSupabaseConfigured()) return MOCK_LOGS;
  try {
    let q = supabase.from('ceres_webhook_log').select('*').order('received_at', { ascending: false }).limit(100);
    if (type && type !== 'all') q = q.eq('webhook_type', type);
    const { data, error } = await q;
    if (error || !data) return MOCK_LOGS;
    return data.map(mapRow);
  } catch {
    return MOCK_LOGS;
  }
}

export function buildIngestionSummary(rows: WebhookLog[]): IngestionSummary {
  const byType: Record<string, number> = {};
  let processed = 0;
  let failed = 0;
  let duplicate = 0;
  const tagSet = new Set<string>();

  for (const r of rows) {
    byType[r.webhookType] = (byType[r.webhookType] ?? 0) + 1;
    if (r.status === 'processed') processed++;
    else if (r.status === 'failed') failed++;
    else if (r.status === 'duplicate') duplicate++;

    const p = r.payload as Record<string, unknown> | null;
    const esn = p?.ESN ?? p?.esn ?? (p?.Data as Record<string, unknown> | undefined)?.ESN ?? (p?.data as Record<string, unknown> | undefined)?.ESN;
    if (esn) tagSet.add(String(esn));
  }

  return {
    total: rows.length,
    processed,
    failed,
    duplicate,
    uniqueTags: tagSet.size,
    lastReceived: rows.length > 0 ? rows[0].receivedAt : null,
    byType,
  };
}

/** Re-run a stored delivery through the same ceres-webhook edge function. */
export async function replayWebhook(log: WebhookLog): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, message: 'Not connected to a live backend.' };
  try {
    const { error } = await supabase.functions.invoke(`ceres-webhook?type=${log.webhookType}`, {
      body: log.payload as Record<string, unknown>,
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Replay failed' };
  }
}

/**
 * SWP §Data Download: required disclaimer whenever raw CERES TAG data is
 * displayed or exported — mirrors CeresDataDisclaimer on the web app verbatim.
 */
export const CERES_DATA_DOWNLOAD_DISCLAIMER =
  'Downloaded data is not controlled and may be used for internal purposes only. ' +
  'Data can only be passed on to Customer Contractors (third parties engaged by the Customer ' +
  'who may use Device Data as directed by the Customer, excluding financial and insurance ' +
  'companies), with the exception of emergency services, such as police. ' +
  'For any data enquiries, email info@cerestag.com';
