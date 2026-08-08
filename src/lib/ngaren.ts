/**
 * Ngaren Asset Code — the unique, app-assigned identifier minted for every
 * animal at capture. It's the animal's primary key across the platform,
 * independent of any physical tag or device (Horizon One: "no device on day 1").
 *
 * Format: NGR-XXXXXX-XXXX where the segments are Crockford-ish base32 derived
 * from the capture timestamp plus randomness — short, human-readable, and
 * collision-resistant enough for a single-farm prototype.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // no I, L, O, U — avoids confusion

function encode(n: number, len: number): string {
  let out = '';
  let v = Math.abs(Math.floor(n));
  for (let i = 0; i < len; i++) {
    out = ALPHABET[v % 32] + out;
    v = Math.floor(v / 32);
  }
  return out;
}

export function generateNgarenCode(): string {
  const time = encode(Date.now(), 6);
  const rand = encode(Math.floor(Math.random() * 32 * 32 * 32 * 32), 4);
  return `NGR-${time}-${rand}`;
}
