/**
 * Who can be a calf's dam or sire (Tester feedback 2026-11-08): only females
 * old enough to have calved, and only males old enough to have sired it.
 * Ages are taken at the calf's birth when it is known, otherwise today.
 *
 * A dam calves at about two years at the earliest; a bull is fertile from
 * about a year, so with nine months' gestation he is at least 18 months old
 * when the calf is born.
 */
import type { Animal } from '@/data/types';

export const DAM_MIN_MONTHS = 24;
export const SIRE_MIN_MONTHS = 18;

/** Whole months from `dob` to `refIso`, or null when either is missing. */
export function monthsBetween(dob: string | undefined, refIso: string): number | null {
  if (!dob) return null;
  const a = new Date(`${dob.slice(0, 10)}T00:00:00Z`);
  const b = new Date(`${refIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m -= 1;
  return m;
}

export type ParentFit = 'ok' | 'age_unknown';

/**
 * Whether `a` can be the calf's dam or sire: 'ok', 'age_unknown' (right sex,
 * no birth date recorded — offered, but flagged), or null (not eligible).
 */
export function parentFit(a: Pick<Animal, 'sex' | 'dateOfBirth'>, role: 'dam' | 'sire', refIso: string): ParentFit | null {
  if (a.sex !== (role === 'dam' ? 'female' : 'male')) return null;
  const months = monthsBetween(a.dateOfBirth, refIso);
  if (months === null) return 'age_unknown';
  return months >= (role === 'dam' ? DAM_MIN_MONTHS : SIRE_MIN_MONTHS) ? 'ok' : null;
}
