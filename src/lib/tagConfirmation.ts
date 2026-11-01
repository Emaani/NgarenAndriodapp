/**
 * "Last confirmed" records for Bluetooth-tagged animals. A Bluetooth tag has no
 * live feed: its dashboard shows the last time someone confirmed the animal
 * (Oct 28 2026 design), so that record has to say how it was confirmed.
 */
import { formatDateTime } from './date';

export interface TagConfirmation {
  animalKey: string;
  /** ISO datetime of the confirmation. */
  at: string;
  by: string;
  /** `ble` = heard by the radio; `manual`/`photo` = confirmed by a person. */
  via: 'ble' | 'manual' | 'photo';
  locationName?: string | null;
  lat?: number;
  lng?: number;
  rssi?: number | null;
}

/** The key confirmations are stored under, matching how reports list an animal. */
export function confirmationKey(a: { ngarenCode?: string | null; accountNumber?: string | null; tag: string }): string {
  return a.ngarenCode ?? a.accountNumber ?? a.tag;
}

/** Keep the newest confirmation per animal. */
export function mergeConfirmations(
  existing: Record<string, TagConfirmation>,
  incoming: TagConfirmation[],
): Record<string, TagConfirmation> {
  const next = { ...existing };
  for (const c of incoming) {
    const current = next[c.animalKey];
    if (!current || current.at <= c.at) next[c.animalKey] = c;
  }
  return next;
}

/** One-line summary: when · by whom · how · where. */
export function confirmationSummary(c: TagConfirmation, t: (key: string) => string): string {
  const place = c.locationName || (c.lat != null && c.lng != null ? `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}` : null);
  return [formatDateTime(c.at), c.by, t(`confirm.via.${c.via}`), place].filter(Boolean).join(' · ');
}
