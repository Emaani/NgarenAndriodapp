/** Stable numeric id from a uuid (48 bits - safe integer, collision-safe at farm scale). */
export function uuidToId(uuid: string): number {
  const hex = uuid.replace(/[^0-9a-f]/gi, '').slice(0, 12) || '0';
  return parseInt(hex, 16);
}
