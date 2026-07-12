/**
 * Canonical date formatting for the whole app.
 *
 * Hermes on some Android builds has limited Intl support, so `toLocaleString`
 * can render inconsistently (or as raw ISO) across devices. These helpers format
 * explicitly and identically everywhere: "12 Mar 2024" for dates, with an
 * optional time. Inputs may be an ISO date ("2024-03-12"), a full ISO datetime,
 * or a Date.
 */
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function toDate(input?: string | number | Date | null): Date | null {
  if (input === null || input === undefined || input === '') return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "2024-03-12" or full ISO -> "12 Mar 2024". Returns '—' for empty/invalid. */
export function formatDate(input?: string | number | Date | null): string {
  // Fast path for plain ISO dates avoids timezone shifting the day.
  if (typeof input === 'string') {
    const m = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const [, y, mo, d] = m;
      return `${d} ${MONTHS_SHORT[Number(mo) - 1]} ${y}`;
    }
  }
  const d = toDate(input);
  if (!d) return '—';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** Full ISO datetime -> "12 Mar 2024, 14:30". Returns '—' for empty/invalid. */
export function formatDateTime(input?: string | number | Date | null): string {
  const d = toDate(input);
  if (!d) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)}, ${hh}:${mm}`;
}
