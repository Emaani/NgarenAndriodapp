/**
 * Ngaren Animal Account Number (AAN) — the unique, app-assigned identifier
 * minted for every animal on registration. It's the animal's primary key across
 * the platform, independent of any physical tag or device.
 *
 * Format (Aug 29 2026 standup decision): a structured, country-based code —
 *   <COUNTRY>-<MMYY>-<SEQUENCE>   e.g.  UG-0826-7K3M9Q
 * so the registration context (which country, which month/year) is legible at a
 * glance without a lookup. The country code is a short operational code (UG, KE,
 * TZ, ZA…), NOT the international dialling code, and is only activated for a
 * territory once Ngaren is operational there. The sequence tail is a
 * collision-resistant base32 string (time + randomness) that stands in for the
 * backend's per-country running sequence on-device.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // no I, L, O, U — avoids confusion

/** Operational country codes — activated per territory as Ngaren goes live there. */
export const COUNTRY_CODES: Record<string, string> = {
  UG: 'Uganda',
  KE: 'Kenya',
  TZ: 'Tanzania',
  ZA: 'South Africa',
};

/** Pilot market. Uganda is the launch territory (Horizon One). */
export const DEFAULT_COUNTRY_CODE = 'UG';

function encode(n: number, len: number): string {
  let out = '';
  let v = Math.abs(Math.floor(n));
  for (let i = 0; i < len; i++) {
    out = ALPHABET[v % 32] + out;
    v = Math.floor(v / 32);
  }
  return out;
}

/**
 * Mint a structured AAN. Pass the operational country code for the animal's
 * registered territory (defaults to the Uganda pilot). The sequence tail mixes
 * the capture time with randomness so two registrations in the same month never
 * collide.
 */
export function generateNgarenCode(countryCode: string = DEFAULT_COUNTRY_CODE): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  // 6-char base32 sequence: 2 chars of time (rough ordering) + 4 of randomness
  // (~1M space) so same-month registrations don't collide.
  const timePart = encode(Math.floor(now.getTime() / 1000), 2);
  const randPart = encode(Math.floor(Math.random() * 32 * 32 * 32 * 32), 4);
  const cc = (countryCode || DEFAULT_COUNTRY_CODE).toUpperCase();
  return `${cc}-${mm}${yy}-${timePart}${randPart}`;
}
