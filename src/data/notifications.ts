/**
 * In-app notifications on Supabase `notifications`, the table the web command
 * centre and the notify-vet function write to. Each row belongs to one user.
 */
import { formatDateTime } from '../lib/date';
import { uuidToId } from '../lib/ids';
import { reportDataFailure, reportDataSuccess } from '../services/dataHealth';
import { supabase } from '../services/supabase';
import { AppNotification, NotificationCategory } from './types';

type Row = Record<string, unknown>;

function categoryOf(type: unknown): NotificationCategory {
  if (type === 'vet_request') return 'booking';
  return type === 'device' || type === 'boundary' ? type : 'account';
}

export function rowToNotification(row: Row): AppNotification {
  return {
    id: uuidToId(String(row.id)),
    remoteId: String(row.id),
    category: categoryOf(row.type),
    title: String(row.title ?? ''),
    message: String(row.body ?? ''),
    timestamp: formatDateTime(String(row.created_at)),
    unread: !row.read,
  };
}

export async function getRemoteNotifications(limit: number): Promise<AppNotification[]> {
  try {
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) return [];
    // Admins can read every row, but the bell is for the signed-in user's own.
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, body, read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) {
      reportDataFailure('notifications', error);
      return [];
    }
    reportDataSuccess();
    return data.map(rowToNotification);
  } catch (e) {
    reportDataFailure('notifications', e);
    return [];
  }
}

/** Best-effort: a row left unread just shows as unread again next time. */
export async function markRemoteNotificationsRead(items: AppNotification[]): Promise<void> {
  const ids = items.filter((n) => n.unread && n.remoteId).map((n) => n.remoteId as string);
  if (ids.length === 0) return;
  try {
    await supabase.from('notifications').update({ read: true }).in('id', ids);
  } catch {
    // retried on the next visit
  }
}
